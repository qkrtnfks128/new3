const config = require("../config");

class Room {
  constructor(roomId, worker) {
    this.id = roomId;
    this.worker = worker;
    this.router = null;
    this.peers = new Map(); // peerId => peer 객체
  }

  /**
   * 방 초기화
   */
  async init() {
    this.router = await this.worker.createRouter(
      this.id
    );
    return this.router;
  }

  /**
   * 방에 피어 추가
   * @param {Object} peer 피어 객체
   */
  addPeer(peer) {
    this.peers.set(peer.id, peer);
  }

  /**
   * 방에서 피어 제거
   * @param {string} peerId 피어 ID
   */
  removePeer(peerId) {
    this.peers.delete(peerId);

    // 방에 더 이상 사용자가 없으면 방 정리
    if (this.peers.size === 0) {
      this.close();
      return true; // 방이 삭제됨
    }
    return false; // 방이 유지됨
  }

  /**
   * 피어 가져오기
   * @param {string} peerId 피어 ID
   * @returns {Object|undefined} 피어 객체
   */
  getPeer(peerId) {
    return this.peers.get(peerId);
  }

  /**
   * 방의 모든 피어 ID 가져오기
   * @returns {Array} 피어 ID 배열
   */
  getPeerIds() {
    return Array.from(this.peers.keys());
  }

  /**
   * 방 내의 다른 모든 피어 ID 가져오기 (특정 피어 제외)
   * @param {string} excludePeerId 제외할 피어 ID
   * @returns {Array} 피어 ID 배열
   */
  getOtherPeerIds(excludePeerId) {
    return Array.from(this.peers.keys()).filter(
      (id) => id !== excludePeerId
    );
  }

  /**
   * 방 종료 및 리소스 정리
   */
  close() {
    this.worker.removeRouter(this.id);

    // 모든 피어의 리소스 정리
    for (const peer of this.peers.values()) {
      peer.close();
    }

    this.peers.clear();
  }

  /**
   * 라우터의 RTP 기능 가져오기
   * @returns {Object} RTP 기능 객체
   */
  async getRtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  /**
   * WebRTC 트랜스포트 생성
   * @param {string} peerId 피어 ID
   * @param {string} transportType 트랜스포트 타입 ('send' 또는 'receive')
   * @returns {Object} 트랜스포트 객체
   */
  async createWebRtcTransport(
    peerId,
    transportType
  ) {
    const {
      listenIps,
      initialAvailableOutgoingBitrate,
    } = config.mediasoup.webRtcTransport;

    const transport =
      await this.router.createWebRtcTransport({
        listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate,
        enableSctp: true,
        numSctpStreams: { OS: 1024, MIS: 1024 },
      });

    transport.on(
      "dtlsstatechange",
      (dtlsState) => {
        if (dtlsState === "closed") {
          console.log(
            `Transport ${transport.id} for peer ${peerId} closed`
          );
        }
      }
    );

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.addTransport(transportType, transport);
    }

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }
}

module.exports = Room;
