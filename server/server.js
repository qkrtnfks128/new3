const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
const { Server } = require("socket.io");
const cors = require("cors");
const config = require("./config");
const mediasoupWorker = require("./lib/Worker");
const RoomManager = require("./lib/RoomManager");
const SocketHandler = require("./lib/SocketHandler");

// Express 앱 생성
const app = express();
app.use(cors());
app.use(express.json());

// SSL 인증서 설정
const options = {
  cert: fs.readFileSync(
    "/etc/letsencrypt/live/rtc.mangki.kr/fullchain.pem"
  ),
  key: fs.readFileSync(
    "/etc/letsencrypt/live/rtc.mangki.kr/privkey.pem"
  ),
};

// HTTPS 서버 생성
const httpsServer = https.createServer(
  options,
  app
);

// Socket.IO 서버 생성
const io = new Server(httpsServer, {
  cors: {
    origin: "https://mangki.kr",
    methods: ["GET", "POST"],
  },
});

// ICE 서버 설정 제거
const iceServers = [];

// config 객체에 iceServers 추가
config.mediasoup = config.mediasoup || {};
config.mediasoup.webRtcTransport =
  config.mediasoup.webRtcTransport || {};
config.mediasoup.webRtcTransport.iceServers =
  iceServers;

// 전역 변수로 roomManager 선언
let roomManager = null;

// API 라우트
app.get("/", (req, res) => {
  res.json({
    status: "mediasoup 서버가 실행 중입니다",
  });
});

// ICE 서버 정보를 클라이언트에 제공하는 API 추가
app.get("/iceServers", (req, res) => {
  res.json({ iceServers });
});

// 방 목록 API
app.get("/rooms", (req, res) => {
  const roomIds = roomManager
    ? roomManager.getRoomIds()
    : [];
  res.json({ rooms: roomIds });
});

// 서버 실행
async function run() {
  try {
    await mediasoupWorker.init();

    // Render 환경을 위한 IP 설정
    if (process.env.RENDER) {
      // 실패 시 Render에서 제공하는 환경변수 사용
      const renderExternalIp =
        process.env.RENDER_EXTERNAL_URL ||
        process.env.RENDER_EXTERNAL_IP;
      if (renderExternalIp) {
        config.mediasoup.webRtcTransport.listenIps.forEach(
          (listenIp) => {
            if (listenIp.ip === "0.0.0.0") {
              listenIp.announcedIp =
                renderExternalIp;
            }
          }
        );
      }
    }

    // 방 관리자 생성
    roomManager = new RoomManager(
      mediasoupWorker
    );

    // 소켓 이벤트 핸들러 설정
    const socketHandler = new SocketHandler(
      io,
      roomManager
    );
    io.on(
      "connection",
      socketHandler.handleConnection
    );

    // HTTPS 서버 시작 (3000 포트 사용)
    httpsServer.listen(3000, () => {
      console.log(
        "HTTPS Server running on port 3000"
      );
    });
  } catch (error) {
    console.error("서버 시작 오류:", error);
    process.exit(1);
  }
}

// 비정상 종료 처리
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on(
  "unhandledRejection",
  (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
  }
);

// 서버 시작
run();
