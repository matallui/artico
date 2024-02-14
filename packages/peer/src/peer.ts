import logger, { LogLevel } from "@rtco/logger";
import EventEmitter from "eventemitter3";
import type { WRTC } from "./util";
import { getBrowserRTC, randomToken } from "./util";

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
  #wrtc: WRTC;
  #pc: RTCPeerConnection;
  #dc?: RTCDataChannel;

  #makingOffer = false;
  #ignoreOffer = false;

  #polite: boolean;
  #initiator: boolean;

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

    logger.debug("Creating Peer");

    if (opts?.debug) {
      logger.logLevel = opts.debug;
    }

    this.#initiator = opts?.initiator ?? false;

    this.config = {
      ...this.config,
      ...opts?.config,
    };

    this.channelName = opts?.channelName || randomToken();
    this.channelConfig = opts?.channelConfig || {};

    // If we are the initiator, we are NOT polite
    this.#polite = !this.#initiator;

    const wrtc = opts?.wrtc ?? getBrowserRTC();
    if (!wrtc) {
      throw new Error("wrtc is required");
    }
    this.#wrtc = wrtc;

    try {
      this.#pc = new this.#wrtc.RTCPeerConnection(opts?.config);
      this.#setupPCListeners();
    } catch (err) {
      throw new Error("WebRTC is not supported by this browser");
    }

    if (this.#initiator) {
      // Start negotiation right away (i.e., don't wait for media to be added)
      this.#onNegotiationNeeded();
    }
  }

  destroy = () => {
    logger.debug("destroy");
    if (this.#dc) {
      this.#dc.close();
      this.#dc.onmessage = null;
      this.#dc.onopen = null;
      this.#dc.onclose = null;
      this.#dc = undefined;
    }
    if (this.#pc) {
      this.#pc.close();
      this.#pc.onnegotiationneeded = null;
      this.#pc.onicecandidate = null;
      this.#pc.oniceconnectionstatechange = null;
      this.#pc.ontrack = null;
      this.#pc.ondatachannel = null;
    }
    this.emit("close");
  };

  signal = async (data: SignalData) => {
    logger.debug("signal:", data);
    try {
      if (data.type === "candidate") {
        const candidate = new this.#wrtc.RTCIceCandidate(data.data);
        try {
          await this.#pc.addIceCandidate(candidate);
        } catch (err) {
          if (!this.#ignoreOffer) {
            throw err;
          }
        }
      } else if (data.type === "sdp") {
        const sdp = data.data;

        const offerCollision =
          sdp.type === "offer" &&
          (this.#makingOffer || this.#pc.signalingState !== "stable");

        this.#ignoreOffer = !this.#polite && offerCollision;
        if (this.#ignoreOffer) {
          return;
        }

        await this.#pc.setRemoteDescription(
          new this.#wrtc.RTCSessionDescription(sdp),
        );
        if (sdp.type === "offer") {
          await this.#pc.setLocalDescription();
          this.emit("signal", {
            type: "sdp",
            data: this.#pc.localDescription as RTCSessionDescription,
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
    logger.debug("send:", data);
    if (!this.#dc) {
      throw new Error("Connection is not established yet.");
    }
    this.#dc.send(data);
  }

  addStream = (stream: MediaStream) => {
    logger.debug("addStream:", stream.id);
    stream.getTracks().forEach((track) => {
      console.log("<Peer> addStream track", track.id);
      this.#pc.addTrack(track, stream);
    });
  };

  removeStream = (stream: MediaStream) => {
    logger.debug("removeStream:", stream.id);
    stream.getTracks().forEach((track) => {
      this.removeTrack(track);
    });
  };

  addTrack = (track: MediaStreamTrack, stream: MediaStream) => {
    logger.debug("addTrack:", track.id, stream.id);
    this.#pc.addTrack(track, stream);
  };

  removeTrack = (track: MediaStreamTrack) => {
    logger.debug("removeTrack:", track.id);
    const sender = this.#pc.getSenders().find((s) => s.track === track);
    if (sender) {
      logger.debug("removeTrack");
      this.#pc.removeTrack(sender);
    }
  };

  // Private methods

  #setupPCListeners = () => {
    logger.debug("Setting up PC listeners");
    this.#pc.onnegotiationneeded = this.#onNegotiationNeeded;
    this.#pc.onicecandidate = this.#onIceCandidate;
    this.#pc.oniceconnectionstatechange = this.#onIceConnectionStateChange;
    this.#pc.ontrack = this.#onTrack;
    this.#pc.ondatachannel = this.#onDataChannel;
  };

  #setupDataChannel = () => {
    logger.debug("Setting up data channel");
    if (!this.#dc) {
      this.emit("error", new Error("Tried to setup undefined data channel."));
      return this.destroy();
    }

    this.channelName = this.#dc?.label || this.channelName;

    this.#dc.onopen = () => {
      this.#onChannelOpen();
    };

    this.#dc.onclose = () => {
      this.#onChannelClose();
    };

    this.#dc.onerror = (event) => {
      logger.debug("Datachannel error:", event);
      const ev = event as RTCErrorEvent;
      const msg = ev.error.message;
      const err =
        ev.error instanceof Error
          ? ev.error
          : new Error(`Datachannel error: ${msg}`);

      this.emit("error", err);
      this.destroy();
    };

    this.#dc.onmessage = this.#onChannelMessage;
  };

  #onNegotiationNeeded = async () => {
    logger.debug("onNegotiationNeeded");
    if (!this.#dc) {
      this.#dc = this.#pc.createDataChannel(
        this.channelName,
        this.channelConfig,
      );
      this.#setupDataChannel();
    }
    try {
      logger.debug("Making offer");
      this.#makingOffer = true;
      await this.#pc.setLocalDescription();
      if (this.#pc.localDescription) {
        logger.debug("Signal localDescription");
        this.emit("signal", {
          type: "sdp",
          data: this.#pc.localDescription,
        });
      }
    } catch (err) {
      this.emit("error", err as Error);
    } finally {
      this.#makingOffer = false;
    }
  };

  #onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    logger.debug("onIceCandidate", event.candidate);
    if (event.candidate) {
      this.emit("signal", {
        type: "candidate",
        data: event.candidate,
      });
    }
  };

  #onIceConnectionStateChange = () => {
    logger.debug("onIceConnectionStateChange", this.#pc.iceConnectionState);
    switch (this.#pc.iceConnectionState) {
      case "disconnected":
        logger.log("iceConnectionState is disconnected, closing");
        this.destroy();
        break;
      case "failed":
        logger.debug("iceConnectionState is failed, restarting");
        this.#pc.restartIce();
        break;
      default:
        // Do nothing
        break;
    }
  };

  #onTrack = (event: RTCTrackEvent) => {
    logger.debug("onTrack", event);
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
    logger.debug("onDataChannel", event);
    this.#dc = event.channel;
    this.#setupDataChannel();
  };

  #onChannelOpen = () => {
    logger.debug("onChannelOpen");
    this.emit("connect");
  };

  #onChannelClose = () => {
    logger.debug("onChannelClose");
    this.destroy();
  };

  #onChannelMessage = (event: MessageEvent<PeerData>) => {
    logger.debug("onChannelMessage", event.data);
    const { data } = event;
    this.emit("data", data);
  };
}
