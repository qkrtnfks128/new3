const mediasoup = require("mediasoup");
const config = require("../config");

class Worker {
  constructor() {
    this.worker = null;
    this.routers = new Map(); // roomId => router
  }

  /**
   * mediasoup worker 초기화
   */
  async init() {
    try {
      this.worker = await mediasoup.createWorker({
        logLevel:
          config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort:
          config.mediasoup.worker.rtcMinPort,
        rtcMaxPort:
          config.mediasoup.worker.rtcMaxPort,
      });

      console.log(
        "mediasoup worker 생성됨 [pid:%d]",
        this.worker.pid
      );

      this.worker.on("died", () => {
        console.error(
          "mediasoup worker가 비정상 종료됨, 프로세스를 종료합니다"
        );
        process.exit(1);
      });

      return this.worker;
    } catch (error) {
      console.error(
        "mediasoup worker 생성 실패:",
        error
      );
      throw error;
    }
  }

  /**
   * 특정 방에 대한 router 생성
   * @param {string} roomId 방 ID
   * @returns {Object} Router 객체
   */
  async createRouter(roomId) {
    if (this.routers.has(roomId)) {
      return this.routers.get(roomId);
    }

    try {
      const router =
        await this.worker.createRouter({
          mediaCodecs:
            config.mediasoup.router.mediaCodecs,
        });

      this.routers.set(roomId, router);
      console.log(
        `방 ${roomId}에 대한 router 생성됨`
      );

      return router;
    } catch (error) {
      console.error(
        `방 ${roomId}에 대한 router 생성 실패:`,
        error
      );
      throw error;
    }
  }

  /**
   * 방의 라우터 가져오기
   * @param {string} roomId 방 ID
   * @returns {Object|null} Router 객체 또는 null
   */
  getRouter(roomId) {
    return this.routers.get(roomId) || null;
  }

  /**
   * 방의 라우터 제거
   * @param {string} roomId 방 ID
   */
  removeRouter(roomId) {
    const router = this.routers.get(roomId);
    if (router) {
      // router는 자동으로 close되지 않으므로 명시적으로 정리
      // router에 연결된 모든 transport들은 자동으로 닫힘
      this.routers.delete(roomId);
      console.log(`방 ${roomId}의 router 제거됨`);
    }
  }
}

module.exports = new Worker();
