import os from "os";

const config = {
  https: {
    listenIP: "0.0.0.0",
    listenPort: "5000",
    certs: {
      sslKey: "./certs/server.key",
      sslCert: "./certs/server.cert",
    },
  },

  mediasoup: {
    numWorkers: Object.keys(os.cpus()).length,
    workerSettings: {
      logLevel: "warn",
      logTags: [
        "info",
        "ice",
        "dtls",
        "rtp",
        "srtp",
        "rtcp",
        "rtx",
        "bwe",
        "score",
        "simulcast",
        "svc",
        "sctp",
      ],
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    },
    webRtcTransportOptions: {
      listenIps: [
        {
          ip: "192.168.151.1",
          announcedIp: "192.168.151.1",
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailaleOutgoingBitrate: 600000,
      maxIncomingBitrate: 1500000,
      maxSctpMessageSize: 262144,
    },
    routerOptions: {
      mediaCodecs: [
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
      ],
    },
  },
};

export default config;
