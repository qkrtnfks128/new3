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

  // Device 로드 및 초기화
  public async loadDevice(): Promise<void> {
    try {
      const response =
        await this.socketService.getRtpCapabilities();
      const rtpCapabilities =
        response.rtpCapabilities as mediasoupTypes.RtpCapabilities;

      // mediasoup 디바이스 생성
      const device = new mediasoupClient.Device();

      // 디바이스 로드
      await device.load({
        routerRtpCapabilities: rtpCapabilities,
      });

      this.mediaState.device = device;
      console.log("Device loaded:", device);
    } catch (error) {
      console.error(
        "Failed to load device:",
        error
      );
      throw error;
    }
  }

  // 전송 및 소비를 위한 Transport 생성
  public async createSendTransport(): Promise<mediasoupClient.types.Transport> {
    if (!this.mediaState.device) {
      throw new Error("Device not loaded");
    }

    try {
      const transportResponse =
        await this.socketService.createWebRtcTransport(
          "send"
        );
      const transportOptions =
        transportResponse as TransportOptions;

      const transport =
        this.mediaState.device.createSendTransport(
          {
            id: transportOptions.id,
            iceParameters:
              transportOptions.iceParameters,
            iceCandidates:
              transportOptions.iceCandidates,
            dtlsParameters:
              transportOptions.dtlsParameters,
            sctpParameters:
              transportOptions.sctpParameters,
          }
        );

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
    } catch (error) {
      console.error(
        "Failed to create send transport:",
        error
      );
      throw error;
    }
  }

  public async createReceiveTransport(): Promise<mediasoupClient.types.Transport> {
    if (!this.mediaState.device) {
      throw new Error("Device not loaded");
    }

    try {
      const transportResponse =
        await this.socketService.createWebRtcTransport(
          "receive"
        );
      const transportOptions =
        transportResponse as TransportOptions;

      const transport =
        this.mediaState.device.createRecvTransport(
          {
            id: transportOptions.id,
            iceParameters:
              transportOptions.iceParameters,
            iceCandidates:
              transportOptions.iceCandidates,
            dtlsParameters:
              transportOptions.dtlsParameters,
            sctpParameters:
              transportOptions.sctpParameters,
          }
        );

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

      this.mediaState.receiveTransport =
        transport;
      return transport;
    } catch (error) {
      console.error(
        "Failed to create receive transport:",
        error
      );
      throw error;
    }
  }

  // 로컬 미디어 스트림 생성 및 전송
  public async createLocalStream(
    constraints: MediaStreamConstraints = {
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }
  ): Promise<MediaStream> {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          constraints
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
      throw error;
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

  // 원격 스트림 소비 (consume)
  public async consumeStream(
    producerId: string
  ): Promise<MediaStreamInfo | null> {
    if (
      !this.mediaState.device ||
      !this.mediaState.receiveTransport
    ) {
      throw new Error(
        "Device or receive transport not created"
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
        };

      const consumer =
        await this.mediaState.receiveTransport.consume(
          {
            id: consumerOptions.id,
            producerId:
              consumerOptions.producerId,
            kind: consumerOptions.kind,
            rtpParameters:
              consumerOptions.rtpParameters,
          }
        );

      this.mediaState.consumers.set(
        producerId,
        consumer
      );

      // Consumer 시작
      await this.socketService.resumeConsumer(
        consumer.id
      );

      // 리모트 스트림 생성
      const stream = new MediaStream([
        consumer.track,
      ]);

      // 스트림 정보 저장
      const peerId =
        consumerOptions.peerId || "unknown";
      const streamInfo: MediaStreamInfo = {
        id: consumer.id,
        peerId,
        track: consumer.track,
        stream,
        type: "remote",
      };

      this.remoteStreams.set(
        consumer.id,
        streamInfo
      );
      this.emitEvent("newStream", streamInfo);

      return streamInfo;
    } catch (error) {
      console.error(
        "Failed to consume stream:",
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
