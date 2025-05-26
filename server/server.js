const express = require("express");
const http = require("http");
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

// HTTP 서버 생성
const server = http.createServer(app);

// Socket.IO 서버 생성
const io = new Server(server, {
  cors: {
    origin: [
      "*",
      "http://localhost:5173",
      "http://localhost:5175",
      "http://172.30.1.85:5175",
    ],
    methods: ["GET", "POST"],
    credentials: false,
  },
  // 소켓 타임아웃 설정도 추가
  pingTimeout: 30000,
  pingInterval: 25000,
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
    // mediasoup worker 초기화
    console.log("mediasoup worker 초기화 중...");
    await mediasoupWorker.init();

    // Render 환경을 위한 설정
    if (process.env.RENDER) {
      // Render에서 실행 중일 때 announcedIp 설정
      const renderExternalIp =
        process.env.RENDER_EXTERNAL_IP ||
        process.env.RENDER_EXTERNAL_URL;
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

    // 서버 시작
    const PORT =
      process.env.PORT || config.server.port;
    server.listen(PORT, () => {
      console.log(
        `mediasoup 서버가 포트 ${PORT}에서 실행 중입니다`
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
