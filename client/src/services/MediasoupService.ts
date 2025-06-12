import * as mediasoupClient from "mediasoup-client";
import { types as mediasoupTypes } from "mediasoup-client";
import SocketService from "./SocketService";
import type {
  MediaState,
  MediaStreamInfo,
  ProducerInfo,
  TransportOptions,
} from "../types/MediasoupTypes";

type EventCallbackData =
  | ProducerInfo
  | MediaStreamInfo
  | { peerId: string; producerId: string }
  | { peerId: string }
  | null
  | Error;

class MediasoupService {
  private static instance: MediasoupService;
  private socketService: SocketService;
  private mediaState: MediaState;
  private remoteStreams: Map<
    string,
    MediaStreamInfo
  > = new Map();
  private eventHandlers: Map<
    string,
    Array<(data: EventCallbackData) => void>
  > = new Map();
  private initializationPromise: Promise<void> | null =
    null;
  private hasMediaPermissions = false;
  private permissionCheckInProgress = false;

  private constructor() {
    this.socketService =
      SocketService.getInstance();

    this.mediaState = {
      device: null,
      sendTransport: null,
      receiveTransport: null,
      producers: new Map(),
      consumers: new Map(),
      videoProducer: null,
      audioProducer: null,
      localStream: null,
    };

    this.setupEventListeners();
  }

  public static getInstance(): MediasoupService {
    if (!MediasoupService.instance) {
      MediasoupService.instance =
        new MediasoupService();
    }
    return MediasoupService.instance;
  }

  private setupEventListeners(): void {
    // 다른 참가자의 새 Producer 생성 이벤트 처리
    this.socketService.on(
      "newProducer",
      async (producerInfo: unknown) => {
        try {
          if (!this.mediaState.device?.loaded) {
            await this.initialize();
          }
          const typedInfo =
            producerInfo as ProducerInfo;
          console.log(
            "New producer from peer",
            typedInfo
          );
          await this.consumeStream(
            typedInfo.producerId
          );
          this.emitEvent(
            "newConsumer",
            typedInfo
          );
        } catch (error) {
          console.error(
            "Failed to consume stream:",
            error
          );
        }
      }
    );

    // Producer가 닫힌 경우 처리
    this.socketService.on(
      "producerClosed",
      (data: unknown) => {
        const typedData = data as {
          peerId: string;
          producerId: string;
        };
        const consumer =
          this.mediaState.consumers.get(
            typedData.producerId
          );
        if (consumer) {
          consumer.close();
          this.mediaState.consumers.delete(
            typedData.producerId
          );

          // 관련 스트림 제거
          for (const [
            id,
            streamInfo,
          ] of this.remoteStreams.entries()) {
            if (
              streamInfo.peerId ===
              typedData.peerId
            ) {
              this.remoteStreams.delete(id);
              this.emitEvent(
                "streamRemoved",
                streamInfo
              );
              break;
            }
          }
        }
      }
    );

    // 참가자가 퇴장한 경우 처리
    this.socketService.on(
      "peerClosed",
      (data: unknown) => {
        const typedData = data as {
          peerId: string;
        };
        // 해당 참가자의 모든 스트림 제거
        for (const [
          id,
          streamInfo,
        ] of this.remoteStreams.entries()) {
          if (
            streamInfo.peerId === typedData.peerId
          ) {
            this.remoteStreams.delete(id);
            this.emitEvent(
              "streamRemoved",
              streamInfo
            );
          }
        }
      }
    );
  }

  // 이벤트 처리 관련 메서드
  public on(
    event: string,
    callback: (data: EventCallbackData) => void
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)?.push(callback);
  }

  public off(
    event: string,
    callback?: (data: EventCallbackData) => void
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
    data: EventCallbackData
  ): void {
    const handlers =
      this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((callback) =>
        callback(data)
      );
    }
  }

  private async initializeDevice(): Promise<void> {
    if (this.mediaState.device?.loaded) {
      return;
    }

    const response =
      await this.socketService.getRtpCapabilities();
    const rtpCapabilities =
      response.rtpCapabilities as mediasoupTypes.RtpCapabilities;

    const device = new mediasoupClient.Device();
    await device.load({
      routerRtpCapabilities: rtpCapabilities,
    });

    this.mediaState.device = device;
    console.log("Device loaded:", device);
  }

  public async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        await this.initializeDevice();
        await this.createSendTransport();
        await this.createReceiveTransport();
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  // 전송 및 소비를 위한 Transport 생성
  public async createSendTransport(): Promise<mediasoupClient.types.Transport> {
    if (this.mediaState.sendTransport) {
      return this.mediaState.sendTransport;
    }

    if (!this.mediaState.device?.loaded) {
      throw new Error("Device not loaded");
    }

    const transportResponse =
      await this.socketService.createWebRtcTransport(
        "send"
      );
    const transportOptions =
      transportResponse as TransportOptions;

    const transport =
      this.mediaState.device.createSendTransport({
        id: transportOptions.id,
        iceParameters:
          transportOptions.iceParameters,
        iceCandidates:
          transportOptions.iceCandidates,
        dtlsParameters:
          transportOptions.dtlsParameters,
        sctpParameters:
          transportOptions.sctpParameters,
      });

    // Transport 이벤트 처리
    transport.on(
      "connect",
      async (
        { dtlsParameters },
        callback,
        errback
      ) => {
        try {
          await this.socketService.connectWebRtcTransport(
            transport.id,
            dtlsParameters,
            "send"
          );
          callback();
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    transport.on(
      "produce",
      async (
        { kind, rtpParameters, appData },
        callback,
        errback
      ) => {
        try {
          const { id } =
            await this.socketService.produce(
              transport.id,
              kind as "audio" | "video",
              rtpParameters,
              appData
            );
          callback({ id });
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    this.mediaState.sendTransport = transport;
    return transport;
  }

  public async createReceiveTransport(): Promise<mediasoupClient.types.Transport> {
    if (this.mediaState.receiveTransport) {
      return this.mediaState.receiveTransport;
    }

    if (!this.mediaState.device?.loaded) {
      throw new Error("Device not loaded");
    }

    const transportResponse =
      await this.socketService.createWebRtcTransport(
        "receive"
      );
    const transportOptions =
      transportResponse as TransportOptions;

    const transport =
      this.mediaState.device.createRecvTransport({
        id: transportOptions.id,
        iceParameters:
          transportOptions.iceParameters,
        iceCandidates:
          transportOptions.iceCandidates,
        dtlsParameters:
          transportOptions.dtlsParameters,
        sctpParameters:
          transportOptions.sctpParameters,
      });

    // Transport 연결 이벤트 처리
    transport.on(
      "connect",
      async (
        { dtlsParameters },
        callback,
        errback
      ) => {
        try {
          await this.socketService.connectWebRtcTransport(
            transport.id,
            dtlsParameters,
            "receive"
          );
          callback();
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    transport.on(
      "connectionstatechange",
      (state) => {
        console.log(
          "Receive transport connection state changed to",
          state
        );
        if (
          state === "failed" ||
          state === "disconnected"
        ) {
          console.warn(
            "Transport connection failed or disconnected"
          );
        }
      }
    );

    this.mediaState.receiveTransport = transport;
    return transport;
  }

  // 로컬 미디어 스트림 생성 및 전송
  public async createLocalStream(
    constraints: MediaStreamConstraints = {
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
    }
  ): Promise<MediaStream> {
    try {
      // 권한 상태 확인 및 요청
      const permissions =
        await this.checkAndRequestPermissions();
      if (!permissions) {
        throw new Error(
          "카메라/마이크 권한이 거부되었습니다."
        );
      }

      console.log(
        "요청된 미디어 제약 조건:",
        constraints
      );

      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
        );

      console.log(
        "로컬 스트림 생성 성공:",
        stream
          .getTracks()
          .map((t) => `${t.kind}: ${t.label}`)
      );

      this.mediaState.localStream = stream;

      const localStreamInfo: MediaStreamInfo = {
        id: "local",
        peerId: "local",
        track: stream.getVideoTracks()[0],
        stream,
        type: "local",
      };

      this.emitEvent(
        "newStream",
        localStreamInfo
      );
      return stream;
    } catch (error) {
      console.error(
        "Failed to get user media:",
        error
      );
      if (error instanceof Error) {
        // 사용자 친화적인 에러 메시지
        if (error.name === "NotAllowedError") {
          throw new Error(
            "카메라/마이크 접근이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요."
          );
        } else if (
          error.name === "NotFoundError"
        ) {
          throw new Error(
            "카메라/마이크를 찾을 수 없습니다."
          );
        } else if (
          error.name === "NotReadableError"
        ) {
          throw new Error(
            "카메라/마이크에 접근할 수 없습니다. 다른 앱이 사용 중일 수 있습니다."
          );
        }
      }
      throw error;
    }
  }

  // 권한 확인 및 요청 메서드 추가
  private async checkAndRequestPermissions(): Promise<boolean> {
    if (this.permissionCheckInProgress)
      return false;

    try {
      this.permissionCheckInProgress = true;
      const permissions = await Promise.all([
        navigator.permissions.query({
          name: "camera" as PermissionName,
        }),
        navigator.permissions.query({
          name: "microphone" as PermissionName,
        }),
      ]);

      this.hasMediaPermissions =
        permissions.every(
          (p) => p.state === "granted"
        );
      return this.hasMediaPermissions;
    } catch (error) {
      console.log("권한 상태 확인 실패:", error);
      return false;
    } finally {
      this.permissionCheckInProgress = false;
    }
  }

  // 미디어 스트림 전송 (produce)
  public async produceStream(
    stream: MediaStream
  ): Promise<void> {
    if (!this.mediaState.sendTransport) {
      throw new Error(
        "Send transport not created"
      );
    }

    try {
      // 현재 URL에서 displayName 가져오기
      const urlParams = new URLSearchParams(
        window.location.search
      );
      const displayName =
        urlParams.get("displayName") ||
        "Anonymous";

      if (stream.getVideoTracks().length > 0) {
        const videoTrack =
          stream.getVideoTracks()[0];
        const videoProducer =
          await this.mediaState.sendTransport.produce(
            {
              track: videoTrack,
              encodings: [
                { maxBitrate: 100000 },
                { maxBitrate: 300000 },
                { maxBitrate: 900000 },
              ],
              codecOptions: {
                videoGoogleStartBitrate: 1000,
              },
              appData: {
                displayName,
              },
            }
          );

        this.mediaState.videoProducer =
          videoProducer;
        this.mediaState.producers.set(
          videoProducer.id,
          videoProducer
        );

        videoProducer.on("trackended", () => {
          console.log("Video track ended");
          this.closeProducer(videoProducer.id);
        });
      }

      if (stream.getAudioTracks().length > 0) {
        const audioTrack =
          stream.getAudioTracks()[0];
        const audioProducer =
          await this.mediaState.sendTransport.produce(
            {
              track: audioTrack,
              codecOptions: {
                opusStereo: true,
                opusDtx: true,
              },
              appData: {
                displayName,
              },
            }
          );

        this.mediaState.audioProducer =
          audioProducer;
        this.mediaState.producers.set(
          audioProducer.id,
          audioProducer
        );

        audioProducer.on("trackended", () => {
          console.log("Audio track ended");
          this.closeProducer(audioProducer.id);
        });
      }
    } catch (error) {
      console.error("Failed to produce:", error);
      throw error;
    }
  }

  // Producer 종료
  public async closeProducer(
    producerId: string
  ): Promise<void> {
    const producer =
      this.mediaState.producers.get(producerId);
    if (!producer) {
      return;
    }

    try {
      await this.socketService.closeProducer(
        producerId
      );
      producer.close();
      this.mediaState.producers.delete(
        producerId
      );

      if (
        this.mediaState.videoProducer?.id ===
        producerId
      ) {
        this.mediaState.videoProducer = null;
      } else if (
        this.mediaState.audioProducer?.id ===
        producerId
      ) {
        this.mediaState.audioProducer = null;
      }
    } catch (error) {
      console.error(
        "Failed to close producer:",
        error
      );
      throw error;
    }
  }

  private async waitForTrack(
    track: MediaStreamTrack
  ): Promise<void> {
    if (track.readyState === "live") return;

    return new Promise((resolve) => {
      const checkState = () => {
        if (track.readyState === "live") {
          resolve();
          return;
        }
        setTimeout(checkState, 100);
      };

      track.onended = () => resolve();
      track.onunmute = () => resolve();

      checkState();
      // 5초 후에도 준비되지 않으면 타임아웃
      setTimeout(resolve, 5000);
    });
  }

  public async consumeStream(
    producerId: string
  ): Promise<MediaStreamInfo | null> {
    if (!this.mediaState.device?.loaded) {
      throw new Error("Device not initialized");
    }

    if (!this.mediaState.receiveTransport) {
      throw new Error(
        "Receive transport not initialized"
      );
    }

    try {
      const consumerResponse =
        await this.socketService.consume(
          producerId,
          this.mediaState.device.rtpCapabilities
        );

      const consumerOptions =
        consumerResponse as {
          id: string;
          producerId: string;
          kind: mediasoupTypes.MediaKind;
          rtpParameters: mediasoupTypes.RtpParameters;
          peerId?: string;
          displayName?: string;
          type?: string;
        };

      console.log(
        "[MediasoupService] Consumer options:",
        consumerOptions
      );

      const consumer =
        await this.mediaState.receiveTransport!.consume(
          {
            id: consumerOptions.id,
            producerId:
              consumerOptions.producerId,
            kind: consumerOptions.kind,
            rtpParameters:
              consumerOptions.rtpParameters,
          }
        );

      // 트랙이 준비될 때까지 대기
      await this.waitForTrack(consumer.track);

      // 트랙 상태 확인 및 활성화
      if (!consumer.track.enabled) {
        consumer.track.enabled = true;
      }

      this.mediaState.consumers.set(
        consumerOptions.producerId,
        consumer
      );

      // Resume the consumer
      await this.socketService.resumeConsumer(
        consumer.id
      );

      // 추가 대기 시간 (Resume 후 트랙이 활성화될 시간)
      await new Promise((resolve) =>
        setTimeout(resolve, 100)
      );

      // 트랙 상태 모니터링 설정
      consumer.track.onmute = () => {
        console.log(
          `[MediasoupService] Track muted:`,
          {
            id: consumer.id,
            kind: consumer.kind,
          }
        );
        if (consumer.track.enabled === false) {
          consumer.track.enabled = true;
        }
      };

      consumer.track.onunmute = () => {
        console.log(
          `[MediasoupService] Track unmuted:`,
          {
            id: consumer.id,
            kind: consumer.kind,
          }
        );
      };

      // 같은 peer의 기존 스트림 찾기
      const peerId =
        consumerOptions.peerId || "unknown";
      const displayName =
        consumerOptions.displayName ||
        "Anonymous";
      // const existingStreamInfo = Array.from(
      //   this.remoteStreams.values()
      // ).find(
      //   (streamInfo) =>
      //     streamInfo.peerId === peerId
      // );

      // if (existingStreamInfo) {
      //   // 기존 스트림에 새 트랙 추가
      //   console.log(
      //     `[MediasoupService] Adding ${consumer.kind} track to existing stream ${existingStreamInfo.id}`
      //   );

      //   // 기존 같은 종류의 트랙이 있다면 제거
      //   const existingTracks =
      //     existingStreamInfo.stream.getTracks();
      //   existingTracks
      //     .filter(
      //       (track) =>
      //         track.kind === consumer.track.kind
      //     )
      //     .forEach((track) => {
      //       existingStreamInfo.stream.removeTrack(
      //         track
      //       );
      //       track.stop();
      //     });

      //   existingStreamInfo.stream.addTrack(
      //     consumer.track
      //   );

      //   // 트랙 정보 업데이트
      //   if (consumer.kind === "video") {
      //     existingStreamInfo.track =
      //       consumer.track;
      //   }

      //   return existingStreamInfo;
      // } else {
      // 새 스트림 생성
      const stream = new MediaStream([
        consumer.track,
      ]);

      const streamInfo: MediaStreamInfo = {
        id: `${peerId}-${consumer.kind}`,
        peerId: peerId,
        stream,
        track: consumer.track,
        type: "remote",
        displayName: displayName,
      };

      this.remoteStreams.set(
        streamInfo.id,
        streamInfo
      );
      this.emitEvent("newStream", streamInfo);
      return streamInfo;
      // }
    } catch (error) {
      console.error(
        "[MediasoupService] Failed to consume stream:",
        error
      );
      return null;
    }
  }

  // 모든 원격 스트림 가져오기
  public getRemoteStreams(): MediaStreamInfo[] {
    return Array.from(
      this.remoteStreams.values()
    );
  }

  // 로컬 스트림 가져오기
  public getLocalStream(): MediaStream | null {
    return this.mediaState.localStream;
  }

  // 모든 리소스 정리
  public async cleanup(): Promise<void> {
    // 모든 Producer 종료
    for (const producerId of this.mediaState.producers.keys()) {
      try {
        await this.closeProducer(producerId);
      } catch (error) {
        console.error(
          `Failed to close producer ${producerId}:`,
          error
        );
      }
    }

    // Consumer 종료
    for (const consumer of this.mediaState.consumers.values()) {
      consumer.close();
    }
    this.mediaState.consumers.clear();

    // Transport 종료
    if (this.mediaState.sendTransport) {
      this.mediaState.sendTransport.close();
      this.mediaState.sendTransport = null;
    }

    if (this.mediaState.receiveTransport) {
      this.mediaState.receiveTransport.close();
      this.mediaState.receiveTransport = null;
    }

    // 로컬 스트림 정리
    if (this.mediaState.localStream) {
      this.mediaState.localStream
        .getTracks()
        .forEach((track) => track.stop());
      this.mediaState.localStream = null;
    }

    // 원격 스트림 정리
    this.remoteStreams.clear();
  }
}

export default MediasoupService;
