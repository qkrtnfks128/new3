const Room = require("./Room");
const Peer = require("./Peer");

class RoomManager {
  constructor(worker) {
    this.worker = worker;
    this.rooms = new Map(); // roomId => Room
  }

  /**
   * 방 생성 또는 기존 방 반환
   * @param {string} roomId 방 ID
   * @returns {Object} Room 객체
   */
  async getOrCreateRoom(roomId) {
    let room = this.rooms.get(roomId);

    if (!room) {
      console.log(`새로운 방 생성: ${roomId}`);
      room = new Room(roomId, this.worker);
      await room.init();
      this.rooms.set(roomId, room);
    }

    return room;
  }

  /**
   * 방 제거
   * @param {string} roomId 방 ID
   */
  removeRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.close();
      this.rooms.delete(roomId);
      console.log(`방 삭제됨: ${roomId}`);
    }
  }

  /**
   * 클라이언트를 방에 참여시킴
   * @param {string} roomId 방 ID
   * @param {string} peerId 피어 ID
   * @param {Object} socket 소켓 객체
   * @returns {Object} 생성된 Peer 객체와 Room 객체
   */
  async joinRoom(roomId, peerId, socket) {
    const room = await this.getOrCreateRoom(
      roomId
    );
    const peer = new Peer(peerId, socket);

    room.addPeer(peer);

    console.log(
      `피어 ${peerId}가 방 ${roomId}에 참여함`
    );

    return { peer, room };
  }

  /**
   * 클라이언트를 방에서 퇴출
   * @param {string} roomId 방 ID
   * @param {string} peerId 피어 ID
   * @returns {boolean} 방이 삭제되었는지 여부
   */
  leaveRoom(roomId, peerId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    console.log(
      `피어 ${peerId}가 방 ${roomId}에서 퇴장`
    );

    // 피어 제거
    const roomEmpty = room.removePeer(peerId);

    // 방이 비었다면 방도 제거
    if (roomEmpty) {
      this.rooms.delete(roomId);
      console.log(`방 ${roomId}가 비어 삭제됨`);
    }

    return roomEmpty;
  }

  /**
   * 방 정보 가져오기
   * @param {string} roomId 방 ID
   * @returns {Object|null} Room 객체 또는 null
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * 모든 방 목록 가져오기
   * @returns {Array} 방 ID 배열
   */
  getRoomIds() {
    return Array.from(this.rooms.keys());
  }
}

module.exports = RoomManager;
