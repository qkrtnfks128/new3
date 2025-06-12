module.exports = {
  server: {
    port: process.env.PORT || 3000,
  },
  mediasoup: {
    // Worker 설정
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 49999, // 충분한 포트 범위 확보
      logLevel: "debug",
      logTags: [
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
    },
    // Router 설정
    router: {
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
      ],
    },
    // WebRtcTransport 설정
    webRtcTransport: {
      listenIps: [
        {
          ip: "0.0.0.0",
          // announcedIp: "169.254.191.188",
          announcedIp: "34.203.42.84",
          // announcedIp: "172.168.10.17",
        },
      ],
      initialAvailableOutgoingBitrate: 600000,
      minimumAvailableOutgoingBitrate: 100000,
      maxSctpMessageSize: 262144,
      enableSctp: true,
      enableUdp: true, // UDP 활성화
      enableTcp: true, // TCP도 활성화
      preferUdp: true, // UDP 선호
      maxIncomingBitrate: 1500000,
    },
  },
};
