import logger, { LogLevel } from "./logger";
import type { WRTC } from "./util";
import { getBrowserRTC, randomId } from "./util";
import EventEmitter from "eventemitter3";

export type SignalData =
  | {
      type: "candidate";
      data: RTCIceCandidate;
    }
  | {
      type: "sdp";
      data: RTCSessionDescription;
    };

export type PeerData = string | ArrayBuffer | Blob | ArrayBufferView;

export type PeerOptions = {
  debug: LogLevel;
  wrtc?: WRTC;
  initiator?: boolean;
  config?: RTCConfiguration;
  channelName?: string;
  channelConfig?: RTCDataChannelInit;
};

export type PeerEvents = {
  close: () => void;
  connect: () => void;
  data: (data: PeerData) => void;
  error: (err: Error) => void;
  removestream: (stream: MediaStream) => void;
  removetrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  signal: (data: SignalData) => void;
  stream: (stream: MediaStream) => void;
  track: (track: MediaStreamTrack, stream: MediaStream) => void;
};

export class Peer extends EventEmitter<PeerEvents> {
  private _wrtc: WRTC;
  private _pc: RTCPeerConnection;
  private _dc?: RTCDataChannel;

  private _makingOffer = false;
  private _ignoreOffer = false;
  private _polite;

  initiator: boolean;

  config: RTCConfiguration = {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:global.stun.twilio.com:3478",
        ],
      },
    ],
  };

  channelName: string;
  channelConfig: RTCDataChannelInit;

  constructor(opts?: Partial<PeerOptions>) {
    super();

    logger.logLevel = opts?.debug || LogLevel.Errors;

    this.initiator = opts?.initiator || false;

    this.config = {
      ...this.config,
      ...opts?.config,
    };

    this.channelName = opts?.channelName || randomId();
    this.channelConfig = opts?.channelConfig || {};

    // If we are the initiator, we are NOT polite
    this._polite = !this.initiator;

    const wrtc = opts?.wrtc ?? getBrowserRTC();
    if (!wrtc) {
      throw new Error("wrtc is required");
    }
    this._wrtc = wrtc;

    try {
      this._pc = new this._wrtc.RTCPeerConnection(opts?.config);
      this.#setupPCListeners();
    } catch (err) {
      throw new Error("WebRTC is not supported by this browser");
    }

    if (this.initiator) {
      // Start negotiation right away (i.e., don't wait for media to be added)
      this.#onNegotiationNeeded();
    }
  }

  destroy = () => {
    if (this._dc) {
      this._dc.close();
      this._dc.onmessage = null;
      this._dc.onopen = null;
      this._dc.onclose = null;
      this._dc = undefined;
    }
    if (this._pc) {
      this._pc.close();
      this._pc.onnegotiationneeded = null;
      this._pc.onicecandidate = null;
      this._pc.oniceconnectionstatechange = null;
      this._pc.ontrack = null;
      this._pc.ondatachannel = null;
    }
    this.emit("close");
  };

  signal = async (data: SignalData) => {
    try {
      if (data.type === "candidate") {
        const candidate = new this._wrtc.RTCIceCandidate(data.data);
        try {
          await this._pc.addIceCandidate(candidate);
        } catch (err) {
          if (!this._ignoreOffer) {
            throw err;
          }
        }
      } else if (data.type === "sdp") {
        const sdp = data.data;

        const offerCollision =
          sdp.type === "offer" &&
          (this._makingOffer || this._pc.signalingState !== "stable");

        this._ignoreOffer = !this._polite && offerCollision;
        if (this._ignoreOffer) {
          return;
        }

        await this._pc.setRemoteDescription(
          new this._wrtc.RTCSessionDescription(sdp)
        );
        if (sdp.type === "offer") {
          await this._pc.setLocalDescription();
          this.emit("signal", {
            type: "sdp",
            data: this._pc.localDescription as RTCSessionDescription,
          });
        }
      }
    } catch (err) {
      this.emit("error", err as Error);
    }
  };

  send(data: string): void;
  send(data: Blob): void;
  send(data: ArrayBuffer): void;
  send(data: ArrayBufferView): void;
  send(data: any): void {
    if (!this._dc) {
      throw new Error("Connection is not established yet.");
    }
    this._dc.send(data);
  }

  addStream = (stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      this._pc.addTrack(track, stream);
    });
  };

  removeStream = (stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      this.removeTrack(track);
    });
  };

  addTrack = (track: MediaStreamTrack, stream: MediaStream) => {
    this._pc.addTrack(track, stream);
  };

  removeTrack = (track: MediaStreamTrack) => {
    const sender = this._pc.getSenders().find((s) => s.track === track);
    if (sender) {
      logger.debug("removeTrack");
      this._pc.removeTrack(sender);
    }
  };

  // Private methods

  #setupPCListeners = () => {
    this._pc.onnegotiationneeded = this.#onNegotiationNeeded;
    this._pc.onicecandidate = this.#onIceCandidate;
    this._pc.oniceconnectionstatechange = this.#onIceConnectionStateChange;
    this._pc.ontrack = this.#onTrack;
    this._pc.ondatachannel = this.#onDataChannel;
  };

  #setupDataChannel = () => {
    if (!this._dc) {
      this.emit("error", new Error("Tried to setup undefined data channel."));
      return this.destroy();
    }

    this.channelName = this._dc?.label || this.channelName;

    this._dc.onopen = () => {
      this.#onChannelOpen();
    };

    this._dc.onclose = () => {
      this.#onChannelClose();
    };

    this._dc.onerror = (event) => {
      const ev = event as RTCErrorEvent;
      const msg = ev.error.message;
      const err =
        ev.error instanceof Error
          ? ev.error
          : new Error(`Datachannel error: ${msg}`);

      this.emit("error", err);
      this.destroy();
    };

    this._dc.onmessage = this.#onChannelMessage;
  };

  #onNegotiationNeeded = async () => {
    logger.debug("onNegotiationNeeded");
    if (!this._dc) {
      this._dc = this._pc.createDataChannel(
        this.channelName,
        this.channelConfig
      );
      this.#setupDataChannel();
    }
    try {
      this._makingOffer = true;
      await this._pc.setLocalDescription();
      if (this._pc.localDescription) {
        this.emit("signal", {
          type: "sdp",
          data: this._pc.localDescription,
        });
      }
    } catch (err) {
      this.emit("error", err as Error);
    } finally {
      this._makingOffer = false;
    }
  };

  #onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      this.emit("signal", {
        type: "candidate",
        data: event.candidate,
      });
    }
  };

  #onIceConnectionStateChange = () => {
    logger.debug("onIceConnectionStateChange", this._pc.iceConnectionState);
    switch (this._pc.iceConnectionState) {
      case "disconnected":
        logger.log("iceConnectionState is disconnected, closing");
        this.destroy();
        break;
      case "failed":
        logger.debug("iceConnectionState is failed, restarting");
        this._pc.restartIce();
        break;
      default:
        // Do nothing
        break;
    }
  };

  #onTrack = (event: RTCTrackEvent) => {
    const stream = event.streams[0] || new MediaStream();

    stream.onremovetrack = (ev) => {
      this.emit("removetrack", ev.track, stream);
      if (stream.getTracks().length === 0) {
        this.emit("removestream", stream);
      }
    };

    if (event.streams.length) {
      this.emit("stream", stream);
    } else {
      stream.addTrack(event.track);
      this.emit("stream", stream);
    }
    this.emit("track", event.track, stream);
  };

  #onDataChannel = (event: RTCDataChannelEvent) => {
    this._dc = event.channel;
    this.#setupDataChannel();
  };

  #onChannelOpen = () => {
    this.emit("connect");
  };

  #onChannelClose = () => {
    this.destroy();
  };

  #onChannelMessage = (event: MessageEvent<PeerData>) => {
    const { data } = event;
    this.emit("data", data);
  };
}
