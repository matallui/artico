import logger from "./logger";
import { randomId } from "./util";
import EventEmitter from "eventemitter3";
// @ts-expect-error no types
import getBrowserRTC from "get-browser-rtc";

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

export type WRTC = {
  RTCPeerConnection: typeof RTCPeerConnection;
  RTCSessionDescription: typeof RTCSessionDescription;
  RTCIceCandidate: typeof RTCIceCandidate;
};

export type PeerOptions = {
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

    this.initiator = opts?.initiator || false;

    this.config = {
      ...this.config,
      ...opts?.config,
    };

    this.channelName = opts?.channelName || randomId();
    this.channelConfig = opts?.channelConfig || {};

    // If we are the initiator, we are NOT polite
    this._polite = !this.initiator;

    this._wrtc = opts?.wrtc || getBrowserRTC();

    if (!this._wrtc) {
      throw new Error("wrtc is required");
    }

    try {
      this._pc = new this._wrtc.RTCPeerConnection(opts?.config);
      this._setupPCListeners();
    } catch (err) {
      throw new Error("WebRTC is not supported by this browser");
    }

    if (this.initiator) {
      // Start negotiation right away (i.e., don't wait for media to be added)
      this._onNegotiationNeeded();
    }
  }

  private _setupPCListeners = () => {
    this._pc.onnegotiationneeded = this._onNegotiationNeeded;
    this._pc.onicecandidate = this._onIceCandidate;
    this._pc.oniceconnectionstatechange = this._onIceConnectionStateChange;
    this._pc.ontrack = this._onTrack;
    this._pc.ondatachannel = this._onDataChannel;
  };

  private _setupDataChannel = () => {
    if (!this._dc) {
      this.emit("error", new Error("Tried to setup undefined data channel."));
      return this.destroy();
    }

    this.channelName = this._dc?.label || this.channelName;

    this._dc.onopen = () => {
      this._onChannelOpen();
    };

    this._dc.onclose = () => {
      this._onChannelClose();
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

    this._dc.onmessage = this._onChannelMessage;
  };

  private _onNegotiationNeeded = async () => {
    logger.debug("onNegotiationNeeded");
    if (!this._dc) {
      this._dc = this._pc.createDataChannel(
        this.channelName,
        this.channelConfig
      );
      this._setupDataChannel();
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

  private _onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      this.emit("signal", {
        type: "candidate",
        data: event.candidate,
      });
    }
  };

  private _onIceConnectionStateChange = () => {
    if (this._pc.iceConnectionState === "failed") {
      this._pc.restartIce();
    }
  };

  private _onTrack = (event: RTCTrackEvent) => {
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

  private _onDataChannel = (event: RTCDataChannelEvent) => {
    this._dc = event.channel;
    this._setupDataChannel();
  };

  private _onChannelOpen = () => {
    this.emit("connect");
  };

  private _onChannelClose = () => {
    this.destroy();
  };

  private _onChannelMessage = (event: MessageEvent) => {
    const { data } = event;
    this.emit("data", data);
  };

  public destroy = () => {
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

  public signal = async (data: SignalData) => {
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

  public send = (data: string | ArrayBuffer | ArrayBufferView | Blob) => {
    if (!this._dc) {
      throw new Error("Connection is not established yet.");
    }
    // @ts-ignore
    this._dc.send(data);
  };

  public addStream = (stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      this._pc.addTrack(track, stream);
    });
  };

  public removeStream = (stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      this.removeTrack(track, stream);
    });
  };

  public addTrack = (track: MediaStreamTrack, stream: MediaStream) => {
    this._pc.addTrack(track, stream);
  };

  public removeTrack = (track: MediaStreamTrack, _stream: MediaStream) => {
    const sender = this._pc.getSenders().find((s) => s.track === track);
    if (sender) {
      logger.debug("removeTrack");
      this._pc.removeTrack(sender);
    }
  };
}
