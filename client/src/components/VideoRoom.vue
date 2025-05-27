<template>
  <div
    class="video-room"
    :class="{
      loading: isLoading,
      error: errorMessage,
    }"
  >
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p class="loading-text">
        화상회의 연결 중...
      </p>
    </div>

    <div
      v-else-if="errorMessage"
      class="error-state"
    >
      <div class="error-icon">⚠️</div>
      <p class="error-text">{{ errorMessage }}</p>
      <button
        class="primary-button"
        @click="goToHome"
      >
        홈으로 돌아가기
      </button>
    </div>

    <template v-else>
      <header class="room-header">
        <div class="room-info">
          <h2 class="room-title">{{ roomId }}</h2>
          <span class="participant-count"
            >참가자
            {{ remoteStreams.length + 1 }}명</span
          >
        </div>
        <div class="header-controls">
          <button
            class="leave-button"
            @click="handleLeaveRoom"
          >
            <span class="leave-icon">🚪</span>
            나가기
          </button>
        </div>
      </header>

      <main class="video-container">
        <section class="local-video-section">
          <div class="video-wrapper local">
            <video
              ref="localVideoRef"
              :autoplay="true"
              :playsinline="true"
              muted
            />
            <div class="video-overlay">
              <div class="participant-info">
                <span class="name"
                  >{{ displayName }} (나)</span
                >
              </div>
              <div class="media-controls">
                <button
                  class="control-button"
                  :class="{
                    'is-disabled':
                      !isVideoEnabled,
                  }"
                  @click="toggleVideo"
                >
                  <span class="icon">
                    {{
                      isVideoEnabled ? "🎥" : "❌"
                    }}
                  </span>
                  <span class="tooltip">
                    {{
                      isVideoEnabled
                        ? "카메라 끄기"
                        : "카메라 켜기"
                    }}
                  </span>
                </button>

                <button
                  class="control-button"
                  :class="{
                    'is-disabled':
                      !isAudioEnabled,
                  }"
                  @click="toggleAudio"
                >
                  <span class="icon">
                    {{
                      isAudioEnabled ? "🎤" : "🔇"
                    }}
                  </span>
                  <span class="tooltip">
                    {{
                      isAudioEnabled
                        ? "마이크 끄기"
                        : "마이크 켜기"
                    }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="remote-video-grid">
          <VideoParticipant
            v-for="stream in remoteStreams"
            :key="stream.id"
            :stream-info="stream"
            class="remote-participant"
          />
        </section>
      </main>
    </template>
  </div>
</template>

<script lang="ts">
  import {
    defineComponent,
    onMounted,
    onUnmounted,
    ref,
    computed,
  } from "vue";
  import {
    useRoute,
    useRouter,
  } from "vue-router";
  import type {
    MediaStreamInfo,
    EventCallbackData,
  } from "../types/MediasoupTypes";
  import SocketService from "../services/SocketService";
  import MediasoupService from "../services/MediasoupService";
  import VideoParticipant from "./VideoParticipant.vue";

  export default defineComponent({
    name: "VideoRoom",
    components: {
      VideoParticipant,
    },
    setup() {
      const route = useRoute();
      const router = useRouter();
      const roomId = ref(
        route.params.roomId as string
      );
      const displayName = ref(
        (route.query.displayName as string) ||
          "Anonymous"
      );
      const isConnected = ref(false);
      const isLoading = ref(true);
      const errorMessage = ref<string | null>(
        null
      );
      const streams = ref<MediaStreamInfo[]>([]);
      const localVideoRef =
        ref<HTMLVideoElement | null>(null);
      const isVideoEnabled = ref(true);
      const isAudioEnabled = ref(true);

      const remoteStreams = computed(() =>
        streams.value.filter(
          (stream) => stream.type === "remote"
        )
      );

      const socketService =
        SocketService.getInstance();
      const mediasoupService =
        MediasoupService.getInstance();

      const initializeLocalDevice = async () => {
        try {
          isLoading.value = false;

          const mediaStream =
            await mediasoupService.createLocalStream(
              {
                video: {
                  width: {
                    ideal: 640,
                    max: 1280,
                  },
                  height: {
                    ideal: 480,
                    max: 720,
                  },
                  frameRate: {
                    ideal: 15,
                    max: 30,
                  },
                },
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
              }
            );

          if (localVideoRef.value) {
            localVideoRef.value.srcObject =
              mediaStream;
            localVideoRef.value.onloadedmetadata =
              () => {
                console.log(
                  "[Media] 비디오 메타데이터 로드됨"
                );
                localVideoRef.value
                  ?.play()
                  .then(() => {
                    setupEventListeners();
                    joinRoom();
                  })
                  .catch((err) => {
                    console.error(
                      "[Media] 비디오 재생 실패",
                      err
                    );
                  });
              };
          }
        } catch (error) {
          console.error(
            "Failed to initialize local device:",
            error
          );
          errorMessage.value = `디바이스 초기화 실패: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`;
        }
      };

      const handleNewStream = (
        data: EventCallbackData
      ) => {
        if (
          !data ||
          !(data as MediaStreamInfo).id
        )
          return;
        const streamInfo =
          data as MediaStreamInfo;
        console.log(
          "[VideoRoom] New stream received:",
          streamInfo
        );

        if (streamInfo.type === "remote") {
          if (streamInfo.id.includes("video")) {
            streams.value = [
              ...streams.value,
              streamInfo,
            ];
          }
        }
      };

      const handleStreamRemoved = (
        data: EventCallbackData
      ) => {
        if (
          !data ||
          !(data as MediaStreamInfo).id
        )
          return;
        const streamInfo =
          data as MediaStreamInfo;
        console.log(
          "[VideoRoom] Stream removed:",
          streamInfo
        );
        streams.value = streams.value.filter(
          (s) => s.id !== streamInfo.id
        );
      };

      const toggleVideo = () => {
        const stream = localVideoRef.value
          ?.srcObject as MediaStream;
        if (!stream) return;

        const videoTracks =
          stream.getVideoTracks();
        videoTracks.forEach((track) => {
          track.enabled = !isVideoEnabled.value;
        });
        isVideoEnabled.value =
          !isVideoEnabled.value;
      };

      const toggleAudio = () => {
        const stream = localVideoRef.value
          ?.srcObject as MediaStream;
        if (!stream) return;

        const audioTracks =
          stream.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = !isAudioEnabled.value;
        });
        isAudioEnabled.value =
          !isAudioEnabled.value;
      };

      const joinRoom = async () => {
        try {
          socketService.connect();
          const peerId = `peer_${Math.floor(
            Math.random() * 1000
          )}`;

          const joinResult =
            await socketService.joinRoom(
              roomId.value,
              peerId,
              displayName.value
            );
          console.log("Join result:", joinResult);

          await mediasoupService.initialize();

          const localStream =
            mediasoupService.getLocalStream();
          if (!localStream) {
            throw new Error(
              "로컬 스트림이 없습니다."
            );
          }

          await mediasoupService.produceStream(
            localStream
          );

          isConnected.value = true;
          isLoading.value = false;
        } catch (error) {
          console.error(
            "Failed to join room:",
            error
          );
          errorMessage.value = `방 참가에 실패했습니다: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`;
          isLoading.value = false;
        }
      };

      const handleLeaveRoom = async () => {
        try {
          if (localVideoRef.value?.srcObject) {
            const stream = localVideoRef.value
              .srcObject as MediaStream;
            stream
              .getTracks()
              .forEach((track) => track.stop());
            localVideoRef.value.srcObject = null;
          }
          await mediasoupService.cleanup();
          await socketService.leaveRoom();
          socketService.disconnect();
          router.push("/");
        } catch (error) {
          console.error(
            "Error leaving room:",
            error
          );
        }
      };

      const goToHome = () => {
        router.push("/");
      };

      const setupEventListeners = () => {
        mediasoupService.on(
          "newStream",
          handleNewStream
        );
        mediasoupService.on(
          "streamRemoved",
          handleStreamRemoved
        );
      };

      const cleanupEventListeners = () => {
        mediasoupService.off(
          "newStream",
          handleNewStream
        );
        mediasoupService.off(
          "streamRemoved",
          handleStreamRemoved
        );
      };

      onMounted(() => {
        if (!roomId.value) {
          errorMessage.value =
            "방 ID가 없습니다.";
          isLoading.value = false;
          return;
        }
        initializeLocalDevice();
      });

      onUnmounted(() => {
        if (isConnected.value) {
          cleanupEventListeners();
          handleLeaveRoom();
        }
      });

      return {
        roomId,
        displayName,
        isConnected,
        isLoading,
        errorMessage,
        remoteStreams,
        localVideoRef,
        isVideoEnabled,
        isAudioEnabled,
        handleLeaveRoom,
        goToHome,
        toggleVideo,
        toggleAudio,
      };
    },
  });
</script>

<style scoped>
  @import "./VideoRoom.css";
</style>
