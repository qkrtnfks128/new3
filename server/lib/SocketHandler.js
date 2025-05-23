class SocketHandler {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.handleConnection =
      this.handleConnection.bind(this);
  }

  /**
   * 소켓 연결 처리
   * @param {Object} socket 소켓 객체
   */
  handleConnection(socket) {
    console.log(
      `클라이언트 연결됨: ${socket.id}`
    );

    socket.on("disconnect", () => {
      console.log(
        `클라이언트 연결 해제: ${socket.id}`
      );
      this.handleDisconnect(socket);
    });

    // 방 관련 이벤트
    socket.on("joinRoom", (data, callback) => {
      this.handleJoinRoom(socket, data, callback);
    });

    socket.on("leaveRoom", (data, callback) => {
      this.handleLeaveRoom(
        socket,
        data,
        callback
      );
    });

    // RTP 기능 요청
    socket.on(
      "getRtpCapabilities",
      (data, callback) => {
        this.handleGetRtpCapabilities(
          socket,
          data,
          callback
        );
      }
    );

    // Transport 관련 이벤트
    socket.on(
      "createWebRtcTransport",
      (data, callback) => {
        this.handleCreateWebRtcTransport(
          socket,
          data,
          callback
        );
      }
    );

    socket.on(
      "connectWebRtcTransport",
      (data, callback) => {
        this.handleConnectWebRtcTransport(
          socket,
          data,
          callback
        );
      }
    );

    // Producer 관련 이벤트
    socket.on("produce", (data, callback) => {
      this.handleProduce(socket, data, callback);
    });

    socket.on(
      "closeProducer",
      (data, callback) => {
        this.handleCloseProducer(
          socket,
          data,
          callback
        );
      }
    );

    // Consumer 관련 이벤트
    socket.on("consume", (data, callback) => {
      this.handleConsume(socket, data, callback);
    });

    socket.on(
      "resumeConsumer",
      (data, callback) => {
        this.handleResumeConsumer(
          socket,
          data,
          callback
        );
      }
    );
  }

  /**
   * 연결 해제 처리
   * @param {Object} socket 소켓 객체
   */
  handleDisconnect(socket) {
    if (socket.roomId && socket.peerId) {
      this.roomManager.leaveRoom(
        socket.roomId,
        socket.peerId
      );

      // 같은 방의 다른 사용자들에게 알림
      socket
        .to(socket.roomId)
        .emit("peerClosed", {
          peerId: socket.peerId,
        });
    }
  }

  /**
   * 방 참여 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleJoinRoom(
    socket,
    { roomId, peerId },
    callback
  ) {
    try {
      if (!roomId || !peerId) {
        return callback({
          error:
            "roomId와 peerId는 필수 항목입니다",
        });
      }

      // 기존에 다른 방에 있었다면 먼저 나가기
      if (socket.roomId && socket.peerId) {
        this.roomManager.leaveRoom(
          socket.roomId,
          socket.peerId
        );
        socket.leave(socket.roomId);
      }

      // 방에 참여
      await this.roomManager.joinRoom(
        roomId,
        peerId,
        socket
      );
      socket.join(roomId);

      // 소켓에 정보 저장
      socket.roomId = roomId;
      socket.peerId = peerId;

      // 같은 방의 다른 peer 목록
      const room =
        this.roomManager.getRoom(roomId);
      const peers = room
        ? room.getOtherPeerIds(peerId)
        : [];

      // 방의 다른 사용자들에게 새 피어가 참여했음을 알림
      socket
        .to(roomId)
        .emit("newPeer", { peerId });

      callback({ peers });
    } catch (error) {
      console.error("방 참여 오류:", error);
      callback({ error: error.message });
    }
  }

  /**
   * 방 퇴장 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  handleLeaveRoom(socket, data, callback) {
    try {
      if (socket.roomId && socket.peerId) {
        this.roomManager.leaveRoom(
          socket.roomId,
          socket.peerId
        );

        // 소켓에서 방 정보 제거
        const roomId = socket.roomId;
        const peerId = socket.peerId;

        socket.leave(roomId);
        socket.roomId = null;
        socket.peerId = null;

        // 같은 방의 다른 사용자들에게 알림
        socket
          .to(roomId)
          .emit("peerClosed", { peerId });

        callback({ success: true });
      } else {
        callback({
          error:
            "현재 방에 참여하고 있지 않습니다",
        });
      }
    } catch (error) {
      console.error("방 퇴장 오류:", error);
      callback({ error: error.message });
    }
  }

  /**
   * RTP 기능 정보 요청 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleGetRtpCapabilities(
    socket,
    data,
    callback
  ) {
    try {
      if (!socket.roomId) {
        return callback({
          error: "먼저 방에 참여해야 합니다",
        });
      }

      const room = this.roomManager.getRoom(
        socket.roomId
      );
      if (!room) {
        return callback({
          error: "방을 찾을 수 없습니다",
        });
      }

      const rtpCapabilities =
        await room.getRtpCapabilities();
      callback({ rtpCapabilities });
    } catch (error) {
      console.error(
        "RTP 기능 정보 요청 오류:",
        error
      );
      callback({ error: error.message });
    }
  }

  /**
   * WebRTC Transport 생성 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleCreateWebRtcTransport(
    socket,
    { transportType },
    callback
  ) {
    try {
      if (!socket.roomId || !socket.peerId) {
        return callback({
          error: "먼저 방에 참여해야 합니다",
        });
      }

      if (
        !transportType ||
        (transportType !== "send" &&
          transportType !== "receive")
      ) {
        return callback({
          error:
            "transportType은 send 또는 receive여야 합니다",
        });
      }

      const room = this.roomManager.getRoom(
        socket.roomId
      );
      if (!room) {
        return callback({
          error: "방을 찾을 수 없습니다",
        });
      }

      const transport =
        await room.createWebRtcTransport(
          socket.peerId,
          transportType
        );
      callback(transport);
    } catch (error) {
      console.error(
        "WebRTC Transport 생성 오류:",
        error
      );
      callback({ error: error.message });
    }
  }

  /**
   * WebRTC Transport 연결 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleConnectWebRtcTransport(
    socket,
    {
      transportId,
      dtlsParameters,
      transportType,
    },
    callback
  ) {
    try {
      if (!socket.roomId || !socket.peerId) {
        return callback({
          error: "먼저 방에 참여해야 합니다",
        });
      }

      const room = this.roomManager.getRoom(
        socket.roomId
      );
      if (!room) {
        return callback({
          error: "방을 찾을 수 없습니다",
        });
      }

      const peer = room.getPeer(socket.peerId);
      if (!peer) {
        return callback({
          error: "피어를 찾을 수 없습니다",
        });
      }

      const transport = peer.getTransport(
        transportType
      );
      if (
        !transport ||
        transport.id !== transportId
      ) {
        return callback({
          error: "트랜스포트를 찾을 수 없습니다",
        });
      }

      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (error) {
      console.error(
        "WebRTC Transport 연결 오류:",
        error
      );
      callback({ error: error.message });
    }
  }

  /**
   * Producer 생성 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleProduce(
    socket,
    { transportId, kind, rtpParameters, appData },
    callback
  ) {
    try {
      if (!socket.roomId || !socket.peerId) {
        return callback({
          error: "먼저 방에 참여해야 합니다",
        });
      }

      const room = this.roomManager.getRoom(
        socket.roomId
      );
      if (!room) {
        return callback({
          error: "방을 찾을 수 없습니다",
        });
      }

      const peer = room.getPeer(socket.peerId);
      if (!peer) {
        return callback({
          error: "피어를 찾을 수 없습니다",
        });
      }

      const producerInfo =
        await peer.createProducer({
          kind,
          rtpParameters,
          appData: appData || {},
        });

      // 방의 다른 참여자들에게 새 프로듀서 생성을 알림
      socket
        .to(socket.roomId)
        .emit("newProducer", {
          peerId: socket.peerId,
          producerId: producerInfo.id,
          kind,
        });

      callback(producerInfo);
    } catch (error) {
      console.error("Producer 생성 오류:", error);
      callback({ error: error.message });
    }
  }

  /**
   * Producer 닫기 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleCloseProducer(
    socket,
    { producerId },
    callback
  ) {
    try {
      if (!socket.roomId || !socket.peerId) {
        return callback({
          error: "먼저 방에 참여해야 합니다",
        });
      }

      const room = this.roomManager.getRoom(
        socket.roomId
      );
      if (!room) {
        return callback({
          error: "방을 찾을 수 없습니다",
        });
      }

      const peer = room.getPeer(socket.peerId);
      if (!peer) {
        return callback({
          error: "피어를 찾을 수 없습니다",
        });
      }

      const producer =
        peer.producers.get(producerId);
      if (!producer) {
        return callback({
          error: "프로듀서를 찾을 수 없습니다",
        });
      }

      producer.close();
      peer.producers.delete(producerId);

      // 방의 다른 참여자들에게 프로듀서 닫힘을 알림
      socket
        .to(socket.roomId)
        .emit("producerClosed", {
          peerId: socket.peerId,
          producerId,
        });

      callback({ success: true });
    } catch (error) {
      console.error("Producer 닫기 오류:", error);
      callback({ error: error.message });
    }
  }

  /**
   * Consumer 생성 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleConsume(
    socket,
    { producerId, rtpCapabilities },
    callback
  ) {
    try {
      if (!socket.roomId || !socket.peerId) {
        return callback({
          error: "먼저 방에 참여해야 합니다",
        });
      }

      const room = this.roomManager.getRoom(
        socket.roomId
      );
      if (!room) {
        return callback({
          error: "방을 찾을 수 없습니다",
        });
      }

      const peer = room.getPeer(socket.peerId);
      if (!peer) {
        return callback({
          error: "피어를 찾을 수 없습니다",
        });
      }

      // consumer 생성
      const consumerInfo =
        await peer.createConsumer(
          room.router,
          producerId,
          rtpCapabilities
        );

      callback(consumerInfo);
    } catch (error) {
      console.error("Consumer 생성 오류:", error);
      callback({ error: error.message });
    }
  }

  /**
   * Consumer 재개 처리
   * @param {Object} socket 소켓 객체
   * @param {Object} data 요청 데이터
   * @param {Function} callback 응답 콜백
   */
  async handleResumeConsumer(
    socket,
    { consumerId },
    callback
  ) {
    try {
      if (!socket.roomId || !socket.peerId) {
        return callback({
          error: "먼저 방에 참여해야 합니다",
        });
      }

      const room = this.roomManager.getRoom(
        socket.roomId
      );
      if (!room) {
        return callback({
          error: "방을 찾을 수 없습니다",
        });
      }

      const peer = room.getPeer(socket.peerId);
      if (!peer) {
        return callback({
          error: "피어를 찾을 수 없습니다",
        });
      }

      const consumer =
        peer.consumers.get(consumerId);
      if (!consumer) {
        return callback({
          error: "컨슈머를 찾을 수 없습니다",
        });
      }

      await consumer.resume();
      callback({ success: true });
    } catch (error) {
      console.error("Consumer 재개 오류:", error);
      callback({ error: error.message });
    }
  }
}

module.exports = SocketHandler;
