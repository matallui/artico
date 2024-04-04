import { LogLevel, Logger } from "@rtco/logger";
import EventEmitter from "eventemitter3";
import { randomToken } from "~/util";

export type Signal =
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
  initiator?: boolean;
  config?: RTCConfiguration;
  channelConfig?: RTCDataChannelInit;
  channelName?: string;
};

export type PeerEvents = {
  close: () => void;
  connect: () => void;
  data: (data: PeerData) => void;
  error: (err: Error) => void;
  removestream: (stream: MediaStream) => void;
  removetrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  signal: (data: Signal) => void;
  stream: (stream: MediaStream) => void;
  track: (track: MediaStreamTrack, stream: MediaStream) => void;
};

interface IPeer {
  destroy(): void;
  signal(data: Signal): Promise<void>;
  send(data: string): void;
  addStream(stream: MediaStream): void;
  removeStream(stream: MediaStream): void;
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  removeTrack(track: MediaStreamTrack): void;
}

export class Peer extends EventEmitter<PeerEvents> implements IPeer {
  #logger: Logger;

  #pc: RTCPeerConnection;
  #dc?: RTCDataChannel;

  #makingOffer = false;
  #ignoreOffer = false;

  #initiator: boolean;

  #config: RTCConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: "stun:stun1.l.google.com:19302",
      },
    ],
  };

  #channelName: string;
  #channelConfig: RTCDataChannelInit;

  constructor(opts?: Partial<PeerOptions>) {
    super();

    this.#logger = new Logger("[peer]", opts?.debug ?? LogLevel.Errors);
    this.#logger.debug("new Peer:", opts);

    this.#initiator = opts?.initiator ?? false;

    this.#config = {
      ...this.#config,
      ...opts?.config,
    };

    this.#channelName = opts?.channelName ?? `dc_${randomToken()}`;
    this.#channelConfig = opts?.channelConfig ?? {};

    try {
      this.#pc = new RTCPeerConnection(this.#config);
      this.#setupPCListeners();
    } catch (err) {
      throw new Error("WebRTC is not supported by this browser");
    }

    if (this.#initiator) {
      // This will trigger onnegotiationneeded
      this.#dc = this.#pc.createDataChannel(
        this.#channelName,
        this.#channelConfig,
      );
      this.#setupDataChannel();
    }
  }

  get ready() {
    return this.#dc?.readyState === "open";
  }

  get #polite() {
    // If we are the initiator, we are NOT polite
    return !this.#initiator;
  }

  destroy = () => {
    this.#logger.debug("destroy()");
    if (this.#dc) {
      this.#removeDataChannelListeners();
      this.#dc.close();
      this.#dc = undefined;
    }
    if (this.#pc) {
      this.#removePCListeners();
      this.#pc.close();
    }
    this.emit("close");
    this.removeAllListeners();
  };

  signal = async (signal: Signal) => {
    this.#logger.debug(`signal(${signal.type})`);
    try {
      if (signal.type === "candidate" && signal.data) {
        try {
          await this.#pc.addIceCandidate(signal.data);
        } catch (err) {
          if (!this.#ignoreOffer) {
            throw err;
          }
        }
      } else if (signal.type === "sdp") {
        const description = signal.data;

        const offerCollision =
          description.type === "offer" &&
          (this.#makingOffer || this.#pc.signalingState !== "stable");

        this.#ignoreOffer = !this.#polite && offerCollision;
        if (this.#ignoreOffer) {
          this.#logger.debug("ignoring offer");
          return;
        }

        await this.#pc.setRemoteDescription(description);

        if (description.type === "offer") {
          await this.#pc.setLocalDescription();
          this.emit("signal", {
            type: "sdp",
            data: this.#pc.localDescription!,
          });
        }
      }
    } catch (err) {
      this.emit("error", err as Error);
    }
  };

  send(data: string): void {
    this.#logger.debug(`send(${data})`);
    if (!this.#dc || !this.ready) {
      throw new Error("Connection is not established yet.");
    }
    this.#dc.send(data);
  }

  addStream = (stream: MediaStream) => {
    this.#logger.debug(`addStream(${stream.id})`);
    stream.getTracks().forEach((track) => {
      this.#pc.addTrack(track, stream);
    });
  };

  removeStream = (stream: MediaStream) => {
    this.#logger.debug(`removeStream(${stream.id})`);
    stream.getTracks().forEach((track) => {
      this.removeTrack(track);
    });
  };

  addTrack = (track: MediaStreamTrack, stream: MediaStream) => {
    this.#logger.debug(`addTrack(${track.id}, ${stream.id})`);
    this.#pc.addTrack(track, stream);
  };

  removeTrack = (track: MediaStreamTrack) => {
    this.#logger.debug(`removeTrack(${track.id})`);
    const sender = this.#pc.getSenders().find((s) => s.track === track);
    if (sender) {
      this.#logger.debug("removeTrack(sender)");
      this.#pc.removeTrack(sender);
    }
  };

  // Private methods

  #setupPCListeners = () => {
    this.#pc.onnegotiationneeded = this.#onNegotiationNeeded;
    this.#pc.onicecandidate = this.#onIceCandidate;
    this.#pc.onicecandidateerror = (event) => {
      this.#logger.debug("onicecandidateerror:", event);
    };
    this.#pc.oniceconnectionstatechange = this.#onIceConnectionStateChange;
    this.#pc.ontrack = this.#onTrack;
    this.#pc.ondatachannel = this.#onDataChannel;
    this.#pc.onicegatheringstatechange = this.#onIceGatheringStateChange;
  };

  #removePCListeners = () => {
    this.#pc.onnegotiationneeded = null;
    this.#pc.onicecandidate = null;
    this.#pc.onicecandidateerror = null;
    this.#pc.oniceconnectionstatechange = null;
    this.#pc.ontrack = null;
    this.#pc.ondatachannel = null;
    this.#pc.onicegatheringstatechange = null;
  };

  #setupDataChannel = () => {
    if (!this.#dc) {
      this.emit("error", new Error("Tried to setup undefined data channel."));
      return this.destroy();
    }

    this.#channelName = this.#dc?.label ?? this.#channelName;

    this.#dc.onopen = () => {
      this.#onChannelOpen();
    };

    this.#dc.onclose = () => {
      this.#onChannelClose();
    };

    this.#dc.onerror = (event) => {
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

  #removeDataChannelListeners = () => {
    if (!this.#dc) {
      return;
    }
    this.#dc.onopen = null;
    this.#dc.onclose = null;
    this.#dc.onerror = null;
    this.#dc.onmessage = null;
  };

  #onNegotiationNeeded = async () => {
    this.#logger.debug("onNegotiationNeeded()");
    try {
      this.#makingOffer = true;
      await this.#pc.setLocalDescription();
      this.emit("signal", {
        type: "sdp",
        data: this.#pc.localDescription!,
      });
    } catch (err) {
      this.emit("error", new Error("Failed to create offer: " + err));
    } finally {
      this.#makingOffer = false;
    }
  };

  #onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
    this.#logger.debug(`onIceCandidate(${event.candidate?.candidate})`);
    if (event.candidate) {
      this.emit("signal", {
        type: "candidate",
        data: event.candidate,
      });
    }
  };

  #onIceConnectionStateChange = () => {
    this.#logger.debug(
      `onIceConnectionStateChange(${this.#pc.iceConnectionState})`,
    );
    switch (this.#pc.iceConnectionState) {
      case "disconnected":
        this.destroy();
        break;
      case "failed":
        this.#pc.restartIce();
        break;
      default:
        // Do nothing
        break;
    }
  };

  #onIceGatheringStateChange = () => {
    this.#logger.debug(
      `onIceGatheringStateChange(${this.#pc.iceGatheringState})`,
    );
  };

  #onTrack = (event: RTCTrackEvent) => {
    this.#logger.debug("onTrack", event);
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
    this.#logger.debug("onDataChannel", event);
    this.#dc = event.channel;
    this.#setupDataChannel();
  };

  #onChannelOpen = () => {
    this.#logger.debug("onChannelOpen");
    this.emit("connect");
  };

  #onChannelClose = () => {
    this.#logger.debug("onChannelClose");
    this.destroy();
  };

  #onChannelMessage = (event: MessageEvent<PeerData>) => {
    this.#logger.debug("onChannelMessage", event.data);
    const { data } = event;
    this.emit("data", data);
  };
}
