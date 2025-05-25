import { io } from "socket.io-client";
import type {
  SocketWithPeerInfo,
  PeerInfo,
  ProducerInfo,
} from "../types/MediasoupTypes";

class SocketService {
  private static instance: SocketService;
  private socket: SocketWithPeerInfo | null =
    null;
  private serverUrl =
    // "https://new3-ztmt.onrender.com";
    "http://44.202.31.246:3000";
  // "http://localhost:3000";

  private eventHandlers: Map<
    string,
    Array<(data: unknown) => void>
  > = new Map();

  // ICE 서버 설정 추가
  private iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:relay.metered.ca:80",
      username: "e8dd65f83899a91a3ecc9826",
      credential: "/jCzMHLJzm3ndH5h",
    },
    {
      urls: "turn:relay.metered.ca:443",
      username: "e8dd65f83899a91a3ecc9826",
      credential: "/jCzMHLJzm3ndH5h",
    },
    {
      urls: "turn:relay.metered.ca:443?transport=tcp",
      username: "e8dd65f83899a91a3ecc9826",
      credential: "/jCzMHLJzm3ndH5h",
    },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance =
        new SocketService();
    }
    return SocketService.instance;
  }

  public connect(): SocketWithPeerInfo {
    if (!this.socket) {
      this.socket = io(this.serverUrl);
      this.setupDefaultEvents();
    }
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupDefaultEvents(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Socket connected");
      this.emitEvent("connect", null);
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
      this.emitEvent("disconnect", null);
    });

    this.socket.on("connect_error", (error) => {
      console.error(
        "Socket connection error:",
        error
      );
      this.emitEvent("error", error);
    });

    this.socket.on(
      "newPeer",
      (data: PeerInfo) => {
        console.log(
          "New peer joined:",
          data.peerId
        );
        this.emitEvent("newPeer", data);
      }
    );

    this.socket.on(
      "peerClosed",
      (data: PeerInfo) => {
        console.log("Peer left:", data.peerId);
        this.emitEvent("peerClosed", data);
      }
    );

    this.socket.on(
      "newProducer",
      (data: ProducerInfo) => {
        console.log("New producer:", data);
        this.emitEvent("newProducer", data);
      }
    );

    this.socket.on(
      "producerClosed",
      (data: {
        peerId: string;
        producerId: string;
      }) => {
        console.log("Producer closed:", data);
        this.emitEvent("producerClosed", data);
      }
    );
  }

  public on(
    event: string,
    callback: (data: unknown) => void
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(callback);
  }

  public off(
    event: string,
    callback?: (data: unknown) => void
  ): void {
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
    return new Promise((resolve, reject) => {
      if (!this.socket) {
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
            reject(
              new Error(String(response.error))
            );
          } else {
            resolve(response as T);
          }
        }
      );
    });
  }

  // Room 관련 메서드
  public joinRoom(
    roomId: string,
    peerId: string
  ): Promise<{ peers: string[] }> {
    return this.request("joinRoom", {
      roomId,
      peerId,
    });
  }

  public leaveRoom(): Promise<{
    success: boolean;
  }> {
    return this.request("leaveRoom", {});
  }

  // Mediasoup 관련 메서드
  public getRtpCapabilities(): Promise<{
    rtpCapabilities: unknown;
  }> {
    return this.request("getRtpCapabilities", {});
  }

  public createWebRtcTransport(
    transportType: "send" | "receive"
  ): Promise<unknown> {
    return this.request("createWebRtcTransport", {
      transportType,
      iceServers: this.iceServers, // STUN/TURN 서버 정보 추가
    });
  }

  public connectWebRtcTransport(
    transportId: string,
    dtlsParameters: unknown,
    transportType: "send" | "receive"
  ): Promise<{ success: boolean }> {
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
    return this.request("closeProducer", {
      producerId,
    });
  }

  public consume(
    producerId: string,
    rtpCapabilities: unknown
  ): Promise<unknown> {
    return this.request("consume", {
      producerId,
      rtpCapabilities,
    });
  }

  public resumeConsumer(
    consumerId: string
  ): Promise<{ success: boolean }> {
    return this.request("resumeConsumer", {
      consumerId,
    });
  }

  // ICE 서버 정보 가져오기
  public getIceServers(): RTCIceServer[] {
    return this.iceServers;
  }

  // ICE 서버 정보를 서버에서 가져오는 메서드 추가
  public async fetchIceServers(): Promise<void> {
    try {
      const response = await fetch(
        `${this.serverUrl}/iceServers`
      );
      const data = await response.json();
      if (data && data.iceServers) {
        this.iceServers = data.iceServers;
      }
    } catch (error) {
      console.error(
        "ICE 서버 정보를 가져오는 데 실패했습니다:",
        error
      );
      // 에러가 발생해도 기본 ICE 서버 설정은 유지됨
    }
  }
}

export default SocketService;
