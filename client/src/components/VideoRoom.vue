<template>
  <div
    class="video-room"
    :class="{
      loading: isLoading,
      error: errorMessage,
    }"
  >
    <div v-if="isLoading" class="loading-message">
      연결 중...
    </div>

    <div
      v-else-if="errorMessage"
      class="error-message"
    >
      {{ errorMessage }}
      <button @click="goToHome">
        홈으로 돌아가기
      </button>
    </div>

    <template v-else>
      <div class="room-header">
        <h2>화상 회의: {{ roomId }}</h2>
        <button
          class="leave-button"
          @click="handleLeaveRoom"
        >
          회의 나가기
        </button>
      </div>

      <div class="video-grid">
        <VideoParticipant
          v-for="streamInfo in mediaStreams"
          :key="`${streamInfo.peerId}-${streamInfo.id}-${streamInfo.type}`"
          :stream="streamInfo.stream"
          :peerId="streamInfo.peerId"
          :isLocal="streamInfo.type === 'local'"
        />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
  import {
    defineComponent,
    onMounted,
    onUnmounted,
    ref,
    watch,
  } from "vue";
  import {
    useRoute,
    useRouter,
  } from "vue-router";
  import type { MediaStreamInfo } from "../types/MediasoupTypes";
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
      const isConnected = ref(false);
      const isLoading = ref(true);
      const errorMessage = ref<string | null>(
        null
      );
      const mediaStreams = ref<MediaStreamInfo[]>(
        []
      );

      const socketService =
        SocketService.getInstance();
      const mediasoupService =
        MediasoupService.getInstance();

      const joinRoom = async () => {
        try {
          isLoading.value = true;

          // 소켓 연결
          socketService.connect();

          // 무작위 Peer ID 생성
          const peerId = `peer_${Math.floor(
            Math.random() * 1000
          )}`;

          // 방 참가
          const joinResult =
            await socketService.joinRoom(
              roomId.value,
              peerId
            );
          console.log("Join result:", joinResult);

          // Device 로드
          await mediasoupService.loadDevice();

          // 전송 및 수신 전송 생성
          await mediasoupService.createSendTransport();
          await mediasoupService.createReceiveTransport();

          // 로컬 스트림 생성
          const localStream =
            await mediasoupService.createLocalStream();

          // 스트림 전송
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

      // 이벤트 리스너 설정
      const setupEventListeners = () => {
        mediasoupService.on(
          "newStream",
          (streamInfo) => {
            mediaStreams.value.push(
              streamInfo as MediaStreamInfo
            );
          }
        );

        mediasoupService.on(
          "streamRemoved",
          (streamInfo) => {
            mediaStreams.value =
              mediaStreams.value.filter(
                (s) =>
                  s.id !==
                  (streamInfo as MediaStreamInfo)
                    .id
              );
          }
        );
      };

      onMounted(() => {
        if (!roomId.value) {
          errorMessage.value =
            "방 ID가 없습니다.";
          isLoading.value = false;
          return;
        }

        setupEventListeners();
        joinRoom();
      });

      onUnmounted(() => {
        if (isConnected.value) {
          mediasoupService.cleanup();
          socketService.leaveRoom();
          socketService.disconnect();
        }
      });

      return {
        roomId,
        isConnected,
        isLoading,
        errorMessage,
        mediaStreams,
        handleLeaveRoom,
        goToHome,
      };
    },
  });
</script>

<style>
  @import "./VideoRoom.css";
</style>
