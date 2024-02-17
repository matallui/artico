export type WRTC = {
  RTCPeerConnection: typeof RTCPeerConnection;
  RTCSessionDescription: typeof RTCSessionDescription;
  RTCIceCandidate: typeof RTCIceCandidate;
};

export const randomToken = () => {
  return Math.random().toString(36).slice(2);
};

export const getBrowserRTC = () => {
  if (typeof globalThis === "undefined") {
    return undefined;
  }

  const wrtc: WRTC = {
    RTCPeerConnection: globalThis.RTCPeerConnection,
    RTCSessionDescription: globalThis.RTCSessionDescription,
    RTCIceCandidate: globalThis.RTCIceCandidate,
  };

  return wrtc;
};
