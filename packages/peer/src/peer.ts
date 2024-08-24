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
  /**
   * The log level (0: none, 1: errors, 2: warnings, 3: info, 4: debug).
   * @defaultValue 1
   */
  debug: LogLevel;
  /**
   * Whether this peer is the initiator.
   * @defaultValue false
   */
  initiator?: boolean;
  /**
   * Optional RTCConfiguration for the peer connection.
   * @defaultValue { iceServers: [ { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" } ] }
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration
   */
  config?: RTCConfiguration;
  /**
   * Optional RTCDataChannelInit for the data channel.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannelInit
   * @defaultValue {}
   */
  channelConfig?: RTCDataChannelInit;
  /**
   * Optional name for the data channel.
   * @defaultValue "dc_${randomToken()}"
   */
  channelName?: string;
};

export type PeerEvents = {
  /**
   * Emitted when the peer connection is closed.
   */
  close: () => void;
  /**
   * Emitted when the data channel is connected.
   */
  connect: () => void;
  /**
   * Emitted when data is received from the peer.
   * @param data - The data received from the peer.
   */
  data: (data: PeerData) => void;
  /**
   * Emitted when an error occurs.
   * @param err - The error that occurred.
   */
  error: (err: Error) => void;
  /**
   * Emitted when a stream is removed from the peer connection.
   * @param stream - The stream that was removed.
   */
  removestream: (stream: MediaStream) => void;
  /**
   * Emitted when a track is removed from the peer connection.
   * @param track - The track that was removed.
   * @param stream - The stream that the track belonged to.
   */
  removetrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  /**
   * Emitted when a signal is received from the peer.
   * @param data - The signal received from the peer.
   */
  signal: (data: Signal) => void;
  /**
   * Emitted when a stream is added to the peer connection.
   * @param stream - The stream that was added.
   */
  stream: (stream: MediaStream) => void;
  /**
   * Emitted when a track is added to the peer connection.
   * @param track - The track that was added.
   * @param stream - The stream that the track belongs to.
   */
  track: (track: MediaStreamTrack, stream: MediaStream) => void;
};

interface IPeer {
  /**
   * Destroys the peer connection.
   * This will close the data channel and the peer connection.
   * Emits a "close" event.
   */
  destroy(): void;
  /**
   * Deliver a remote signal to the local peer.
   * @param data - The signal to deliver.
   */
  signal(data: Signal): Promise<void>;
  /**
   * Send a message to the remote peer.
   * @param data - The message to send.
   */
  send(data: string): void;
  /**
   * Add a stream to the peer connection.
   * @param stream - The stream to add.
   */
  addStream(stream: MediaStream): void;
  /**
   * Remove a stream from the peer connection.
   * @param stream - The stream to remove.
   */
  removeStream(stream: MediaStream): void;
  /**
   * Add a track to the peer connection.
   * @param track - The track to add.
   * @param stream - The stream that the track belongs to.
   */
  addTrack(track: MediaStreamTrack, stream: MediaStream): void;
  /**
   * Remove a stream from the peer connection.
   * @param stream - The stream to remove.
   */
  removeTrack(track: MediaStreamTrack): void;
}

/**
 * RTCPeerConnection abstraction.
 */
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
    for (const track of stream.getTracks()) {
      this.#pc.addTrack(track, stream);
    }
  };

  removeStream = (stream: MediaStream) => {
    this.#logger.debug(`removeStream(${stream.id})`);
    for (const track of stream.getTracks()) {
      this.removeTrack(track);
    }
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
      this.emit("error", new Error(`Failed to create offer: ${err}`));
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
