import { io } from "socket.io-client";
import type {
  SocketWithPeerInfo,
  PeerInfo,
  ProducerInfo,
} from "../types/MediasoupTypes";

/**
 * 화상회의 정상 연결 시 로그 순서 및 흐름
 *
 * 1. 소켓 연결 시작: 서버와 소켓 연결 시작
 * 2. 소켓 객체 생성됨: 소켓 객체 생성
 * 3. 소켓 연결 완료: 소켓 연결 완료
 * 6. 기본 이벤트 리스너 설정 시작: 소켓 이벤트 리스너 설정
 * 7. 소켓 연결됨: 소켓 연결 확인
 * 14. 기본 이벤트 리스너 설정 완료: 이벤트 리스너 설정 완료
 * 15. 이벤트 리스너 등록: 소켓 이벤트 리스너 등록
 * 18. 소켓 요청 시작: 방 참가 요청
 * 22. 방 참가 요청: roomId와 peerId로 방 참가 요청
 * 21. 소켓 요청 성공: 방 참가 요청 성공
 * 18. 소켓 요청 시작: RTP 기능 요청
 * 24. RTP 기능 요청: 미디어 설정을 위한 RTP 기능 요청
 * 21. 소켓 요청 성공: RTP 기능 요청 성공
 * 18. 소켓 요청 시작: WebRTC 트랜스포트 생성 요청
 * 25. WebRTC 트랜스포트 생성 요청: 전송 트랜스포트 생성 요청
 * 21. 소켓 요청 성공: 트랜스포트 생성 성공
 * 18. 소켓 요청 시작: WebRTC 트랜스포트 연결 요청
 * 26. WebRTC 트랜스포트 연결 요청: 트랜스포트 연결 요청
 * 21. 소켓 요청 성공: 트랜스포트 연결 성공
 * 18. 소켓 요청 시작: WebRTC 트랜스포트 생성 요청
 * 25. WebRTC 트랜스포트 생성 요청: 수신 트랜스포트 생성 요청
 * 21. 소켓 요청 성공: 수신 트랜스포트 생성 성공
 * 18. 소켓 요청 시작: WebRTC 트랜스포트 연결 요청
 * 26. WebRTC 트랜스포트 연결 요청: 수신 트랜스포트 연결 요청
 * 21. 소켓 요청 성공: 수신 트랜스포트 연결 성공
 * 18. 소켓 요청 시작: 미디어 프로듀서 생성 요청
 * 27. 미디어 프로듀서 생성 요청: 오디오/비디오 미디어 스트림 전송 시작
 * 21. 소켓 요청 성공: 미디어 프로듀서 생성 성공
 *
 * [원격 참가자가 있는 경우]
 * 12. 새로운 프로듀서 생성: 원격 사용자 미디어 수신 시작
 * 18. 소켓 요청 시작: 미디어 소비 요청
 * 29. 미디어 소비 요청: 원격 사용자 미디어 소비 요청
 * 21. 소켓 요청 성공: 미디어 소비 요청 성공
 * 18. 소켓 요청 시작: 소비자 재개 요청
 * 30. 소비자 재개 요청: 미디어 스트림 재생 시작
 * 21. 소켓 요청 성공: 소비자 재개 요청 성공
 *
 * [종료 시]
 * 23. 방 퇴장 요청: 방 퇴장 요청
 * 4. 소켓 연결 해제 시작: 소켓 연결 종료 시작
 * 5. 소켓 연결 해제 완료: 소켓 연결 종료 완료
 *
 * ICE 서버 정보 관련 로그(31-34)는 연결 과정 중 필요할 때 나타날 수 있으며
 * 연결 성공의 필수 지표는 아닙니다.
 */
class SocketService {
  private static instance: SocketService;
  private socket: SocketWithPeerInfo | null =
    null;
  // private serverUrl = "http://localhost:3000";
  private serverUrl =
    "https://44.202.31.246:3000";
  // private serverUrl =
  //   "https://new3-ztmt.onrender.com";

  private eventHandlers: Map<
    string,
    Array<(data: unknown) => void>
  > = new Map();

  // ICE 서버 설정 제거
  private iceServers = [];

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance =
        new SocketService();
    }
    return SocketService.instance;
  }

  public connect(): SocketWithPeerInfo {
    console.log("1. 소켓 연결 시작");
    if (!this.socket) {
      this.socket = io(this.serverUrl);
      console.log("2. 소켓 객체 생성됨");
      this.setupDefaultEvents();
    }
    console.log("3. 소켓 연결 완료");
    return this.socket;
  }

  public disconnect(): void {
    console.log("4. 소켓 연결 해제 시작");
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log("5. 소켓 연결 해제 완료");
    }
  }

  private setupDefaultEvents(): void {
    console.log(
      "6. 기본 이벤트 리스너 설정 시작"
    );
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("7. 소켓 연결됨");
      this.emitEvent("connect", null);
    });

    this.socket.on("disconnect", () => {
      console.log("8. 소켓 연결 해제됨");
      this.emitEvent("disconnect", null);
    });

    this.socket.on("connect_error", (error) => {
      console.error("9. 소켓 연결 오류:", error);
      this.emitEvent("error", error);
    });

    this.socket.on(
      "newPeer",
      (data: PeerInfo) => {
        console.log(
          "10. 새로운 피어 참가:",
          data.peerId
        );
        this.emitEvent("newPeer", data);
      }
    );

    this.socket.on(
      "peerClosed",
      (data: PeerInfo) => {
        console.log(
          "11. 피어 퇴장:",
          data.peerId
        );
        this.emitEvent("peerClosed", data);
      }
    );

    this.socket.on(
      "newProducer",
      (data: ProducerInfo) => {
        console.log(
          "12. 새로운 프로듀서 생성:",
          data
        );
        this.emitEvent("newProducer", data);
      }
    );

    this.socket.on(
      "producerClosed",
      (data: {
        peerId: string;
        producerId: string;
      }) => {
        console.log("13. 프로듀서 종료:", data);
        this.emitEvent("producerClosed", data);
      }
    );

    console.log(
      "14. 기본 이벤트 리스너 설정 완료"
    );
  }

  public on(
    event: string,
    callback: (data: unknown) => void
  ): void {
    console.log(
      `15. 이벤트 리스너 등록: ${event}`
    );
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(callback);
  }

  public off(
    event: string,
    callback?: (data: unknown) => void
  ): void {
    console.log(
      `16. 이벤트 리스너 제거: ${event}`
    );
    if (!callback) {
      this.eventHandlers.delete(event);
      return;
    }

    const handlers =
      this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index !== -1) {
        handlers.splice(index, 1);
        if (handlers.length === 0) {
          this.eventHandlers.delete(event);
        }
      }
    }
  }

  private emitEvent(
    event: string,
    data: unknown
  ): void {
    console.log(`17. 내부 이벤트 발생: ${event}`);
    const handlers =
      this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((callback) =>
        callback(data)
      );
    }
  }

  // Socket.IO 이벤트를 Promise로 래핑하는 유틸리티 메서드
  public request<T>(
    event: string,
    data: unknown
  ): Promise<T> {
    console.log(
      `18. 소켓 요청 시작: ${event}`,
      data
    );
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        console.error("19. 소켓이 연결되지 않음");
        reject(new Error("Socket not connected"));
        return;
      }

      this.socket.emit(
        event,
        data,
        (response: unknown) => {
          if (
            response &&
            typeof response === "object" &&
            "error" in response
          ) {
            console.error(
              `20. 소켓 요청 실패: ${event}`,
              response.error
            );
            reject(
              new Error(String(response.error))
            );
          } else {
            console.log(
              `21. 소켓 요청 성공: ${event}`,
              response
            );
            resolve(response as T);
          }
        }
      );
    });
  }

  // Room 관련 메서드
  public joinRoom(
    roomId: string,
    peerId: string,
    displayName: string
  ): Promise<{ peers: string[] }> {
    console.log("22. 방 참가 요청:", {
      roomId,
      peerId,
      displayName,
    });
    return this.request("joinRoom", {
      roomId,
      peerId,
      displayName,
    });
  }

  public leaveRoom(): Promise<{
    success: boolean;
  }> {
    console.log("23. 방 퇴장 요청");
    return this.request("leaveRoom", {});
  }

  // Mediasoup 관련 메서드
  public getRtpCapabilities(): Promise<{
    rtpCapabilities: unknown;
  }> {
    console.log("24. RTP 기능 요청");
    return this.request("getRtpCapabilities", {});
  }

  public createWebRtcTransport(
    transportType: "send" | "receive"
  ): Promise<unknown> {
    console.log(
      `25. WebRTC 트랜스포트 생성 요청: ${transportType}`
    );
    return this.request("createWebRtcTransport", {
      transportType,
    });
  }

  public connectWebRtcTransport(
    transportId: string,
    dtlsParameters: unknown,
    transportType: "send" | "receive"
  ): Promise<{ success: boolean }> {
    console.log(
      `26. WebRTC 트랜스포트 연결 요청: ${transportType}, transportId=${transportId}`
    );
    return this.request(
      "connectWebRtcTransport",
      {
        transportId,
        dtlsParameters,
        transportType,
      }
    );
  }

  public produce(
    transportId: string,
    kind: "audio" | "video",
    rtpParameters: unknown,
    appData?: unknown
  ): Promise<{ id: string }> {
    console.log(
      `27. 미디어 프로듀서 생성 요청: ${kind}, transportId=${transportId}`
    );
    return this.request("produce", {
      transportId,
      kind,
      rtpParameters,
      appData,
    });
  }

  public closeProducer(
    producerId: string
  ): Promise<{ success: boolean }> {
    console.log(
      `28. 프로듀서 종료 요청: producerId=${producerId}`
    );
    return this.request("closeProducer", {
      producerId,
    });
  }

  public consume(
    producerId: string,
    rtpCapabilities: unknown
  ): Promise<unknown> {
    console.log(
      `29. 미디어 소비 요청: producerId=${producerId}`
    );
    return this.request("consume", {
      producerId,
      rtpCapabilities,
    });
  }

  public resumeConsumer(
    consumerId: string
  ): Promise<{ success: boolean }> {
    console.log(
      `30. 소비자 재개 요청: consumerId=${consumerId}`
    );
    return this.request("resumeConsumer", {
      consumerId,
    });
  }

  // ICE 서버 정보 가져오기
  public getIceServers(): RTCIceServer[] {
    console.log("31. ICE 서버 정보 요청");
    return this.iceServers;
  }

  // ICE 서버 정보를 서버에서 가져오는 메서드 추가
  public async fetchIceServers(): Promise<void> {
    console.log(
      "32. 서버에서 ICE 서버 정보 가져오기 시도"
    );
    try {
      const response = await fetch(
        `${this.serverUrl}/iceServers`
      );
      const data = await response.json();
      if (data && data.iceServers) {
        this.iceServers = data.iceServers;
        console.log(
          "33. ICE 서버 정보 업데이트 성공:",
          this.iceServers
        );
      }
    } catch (error) {
      console.error(
        "34. ICE 서버 정보를 가져오는 데 실패했습니다:",
        error
      );
      // 에러가 발생해도 기본 ICE 서버 설정은 유지됨
    }
  }
}

export default SocketService;
