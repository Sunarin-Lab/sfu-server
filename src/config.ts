import os from "os";
import { RtpCodecCapability, WebRtcTransportOptions } from "mediasoup/node/lib/types";

/**
 ********************************
 * HTTPS Config
 ********************************
 */
export const https = {
  listenIP: "0.0.0.0",
  listenPort: "5000",
  certs: {
    sslKey: "./certs/sfu.server.key",
    sslCert: "./certs/sfu.server.crt",
  },
};

/**
 ********************************
 * Mediasoup Worker Options
 ********************************
 */
export const workerOptions = {
  numWorkers: Object.keys(os.cpus()).length,
  workerSettings: {
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp", "rtx", "bwe", "score", "simulcast", "svc", "sctp"],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  },
};

/**
 ********************************
 * WEBRTC Transport Options
 ********************************
 */
export const webRtcTransportOptions: WebRtcTransportOptions = {
  listenIps: [
    {
      ip: "10.10.10.12",
      announcedIp: "10.10.10.12",
    },
  ],
  enableTcp: true,
  enableUdp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: 1000000,
  maxSctpMessageSize: 262144,
};

/**
 ********************************
 * Codecs Options
 ********************************
 */
export const codecs: Array<RtpCodecCapability> = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/VP9",
    clockRate: 90000,
    parameters: {
      "profile-id": 2,
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/h264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "4d0032",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
  {
    kind: "video",
    mimeType: "video/h264",
    clockRate: 90000,
    parameters: {
      "packetization-mode": 1,
      "profile-level-id": "42e01f",
      "level-asymmetry-allowed": 1,
      "x-google-start-bitrate": 1000,
    },
  },
];
