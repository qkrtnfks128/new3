<template>
  <div class="video-participant">
    <video
      ref="videoRef"
      :autoplay="true"
      :playsinline="true"
    />
    <div class="participant-info">
      <span class="name">{{ displayName }}</span>
      <div class="debug-info">
        <p>id: {{ streamInfo.id }}</p>
        <p>Video Tracks: {{ videoTrackCount }}</p>
        <p>Audio Tracks: {{ audioTrackCount }}</p>
        <p>Stream Active: {{ isStreamActive }}</p>
        <p>Video Ready: {{ isVideoReady }}</p>
        <p>Track States: {{ trackStates }}</p>
      </div>
    </div>

    <!-- 컨트롤 버튼 추가 -->
    <!-- <div class="stream-controls">
      <button
        class="control-btn"
        :class="{ active: isVideoEnabled }"
        @click="toggleVideo"
      >
        <span class="icon">
          {{ isVideoEnabled ? "🎥" : "❌" }}
        </span>
        <span class="tooltip">{{
          isVideoEnabled
            ? "카메라 끄기"
            : "카메라 켜기"
        }}</span>
      </button>

      <button
        class="control-btn"
        :class="{ active: isAudioEnabled }"
        @click="toggleAudio"
      >
        <span class="icon">
          {{ isAudioEnabled ? "🎤" : "🔇" }}
        </span>
        <span class="tooltip">{{
          isAudioEnabled
            ? "마이크 끄기"
            : "마이크 켜기"
        }}</span>
      </button>
    </div> -->
  </div>
</template>

<script lang="ts">
  import {
    ref,
    onMounted,
    watch,
    computed,
    onUnmounted,
    defineComponent,
  } from "vue";
  import type { MediaStreamInfo } from "../types/MediasoupTypes";

  export default defineComponent({
    name: "VideoParticipant",
    props: {
      streamInfo: {
        type: Object as () => MediaStreamInfo,
        required: true,
      },
      showDebug: {
        type: Boolean,
        default: false,
      },
    },
    setup(props) {
      const videoRef =
        ref<HTMLVideoElement | null>(null);
      const isVideoReady = ref(false);
      const trackListeners = new Map();

      const displayName = computed(
        () =>
          props.streamInfo.displayName ||
          "Anonymous"
      );

      const videoTrackCount = computed(
        () =>
          props.streamInfo.stream?.getVideoTracks()
            .length || 0
      );

      const audioTrackCount = computed(
        () =>
          props.streamInfo.stream?.getAudioTracks()
            .length || 0
      );

      const isStreamActive = computed(
        () =>
          props.streamInfo.stream?.active || false
      );

      const trackStates = computed(() => {
        if (!props.streamInfo.stream)
          return "No stream";
        return props.streamInfo.stream
          .getTracks()
          .map((track) => ({
            kind: track.kind,
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
          }));
      });

      let retryCount = 0;
      const MAX_RETRIES = 3;

      async function tryPlay(
        video: HTMLVideoElement
      ): Promise<void> {
        try {
          console.log("tryPlay", video);
          await video.play();
          isVideoReady.value = true;
          retryCount = 0;
        } catch (e) {
          console.warn(
            `Play attempt ${
              retryCount + 1
            } failed:`,
            e
          );
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            // 100ms 후에 다시 시도
            setTimeout(() => tryPlay(video), 100);
          } else {
            console.error(
              "Max retry attempts reached"
            );
            video.controls = true;
          }
        }
      }

      // cleanup 함수를 먼저 정의
      const cleanup = () => {
        if (props.streamInfo.stream) {
          props.streamInfo.stream
            .getTracks()
            .forEach((track) => {
              const listeners =
                trackListeners.get(track);
              if (listeners) {
                track.removeEventListener(
                  "ended",
                  listeners.ended
                );
                track.removeEventListener(
                  "mute",
                  listeners.mute
                );
                track.removeEventListener(
                  "unmute",
                  listeners.unmute
                );
              }
            });
        }
      };

      // onUnmounted를 setup 함수 시작 부분에서 호출
      onUnmounted(cleanup);

      async function setupVideo() {
        console.log(
          "setupVideo start",
          videoRef.value,
          props.streamInfo.stream
        );
        const video = videoRef.value;
        if (!video || !props.streamInfo.stream) {
          console.log(
            "setupVideo",
            video,
            props.streamInfo.stream
          );
          return;
        }

        try {
          // 기존 스트림 정리
          // if (video.srcObject) {
          //   const oldStream =
          //     video.srcObject as MediaStream;
          //   oldStream
          //     .getTracks()
          //     .forEach((track) => {
          //       track.stop();
          //       oldStream.removeTrack(track);
          //     });
          // }

          // 새 스트림 설정 전 트랙 상태 확인
          console.log(
            ".getTracks()",
            props.streamInfo.stream.getTracks()
          );
          props.streamInfo.stream
            .getTracks()
            .forEach((track) => {
              if (!track.enabled) {
                track.enabled = true;
              }
            });

          // 새 스트림 설정
          // video.srcObject = null; // 명시적으로 null 설정
          await new Promise((resolve) =>
            setTimeout(resolve, 0)
          ); // 마이크로태스크 대기
          video.srcObject =
            props.streamInfo.stream;

          // 트랙 상태 모니터링
          props.streamInfo.stream
            .getTracks()
            .forEach((track) => {
              const listeners = {
                ended: () => {
                  console.log(
                    `Track ended: ${track.kind}`
                  );
                  isVideoReady.value = false;
                  if (track.kind === "video") {
                    tryPlay(video);
                  }
                },
                mute: () => {
                  console.log(
                    `Track muted: ${track.kind}`
                  );
                  if (track.kind === "video") {
                    track.enabled = true;
                  }
                },
                unmute: () => {
                  console.log(
                    `Track unmuted: ${track.kind}`
                  );
                  if (
                    track.kind === "video" &&
                    !isVideoReady.value
                  ) {
                    tryPlay(video);
                  }
                },
              };

              track.addEventListener(
                "ended",
                listeners.ended
              );
              track.addEventListener(
                "mute",
                listeners.mute
              );
              track.addEventListener(
                "unmute",
                listeners.unmute
              );

              trackListeners.set(
                track,
                listeners
              );
            });

          await tryPlay(video);
        } catch (error) {
          console.error(
            "Failed to setup video:",
            error
          );
          isVideoReady.value = false;
        }
      }

      // 스트림 변경 감시
      // watch(
      //   () => props.streamInfo.stream,
      //   setupVideo,
      //   { immediate: true }
      // );

      // 컴포넌트 마운트
      onMounted(() => {
        console.log(
          `[VideoParticipant] Mounted for ${props.streamInfo.peerId}`
        );
        setupVideo();
      });

      // 컴포넌트 언마운트
      onUnmounted(() => {
        const video = videoRef.value;
        if (video && video.srcObject) {
          const stream =
            video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            track.stop();
            stream.removeTrack(track);
          });
          video.srcObject = null;
        }
      });

      // 비디오/오디오 활성화 상태 추적
      const isVideoEnabled = ref(true);
      const isAudioEnabled = ref(true);

      // 비디오 토글 함수
      const toggleVideo = () => {
        if (!props.streamInfo.stream) return;

        const videoTracks =
          props.streamInfo.stream.getVideoTracks();
        videoTracks.forEach((track) => {
          track.enabled = !isVideoEnabled.value;
        });
        console.log(
          "props.streamInfo.stream",
          props.streamInfo.stream
        );
        isVideoEnabled.value =
          !isVideoEnabled.value;

        // 상태 변경 로깅
        console.log("Video state changed:", {
          enabled: isVideoEnabled.value,
          tracks: videoTracks.map((t) => ({
            id: t.id,
            enabled: t.enabled,
          })),
        });
      };

      // 오디오 토글 함수
      const toggleAudio = () => {
        if (!props.streamInfo.stream) return;

        const audioTracks =
          props.streamInfo.stream.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = !isAudioEnabled.value;
        });

        isAudioEnabled.value =
          !isAudioEnabled.value;

        // 상태 변경 로깅
        console.log("Audio state changed:", {
          enabled: isAudioEnabled.value,
          tracks: audioTracks.map((t) => ({
            id: t.id,
            enabled: t.enabled,
          })),
        });
      };

      // 초기 트랙 상태 설정
      watch(
        () => props.streamInfo.stream,
        (newStream) => {
          if (newStream) {
            // 비디오 트랙 상태 초기화
            const videoTrack =
              newStream.getVideoTracks()[0];
            if (videoTrack) {
              isVideoEnabled.value =
                videoTrack.enabled;
            }

            // 오디오 트랙 상태 초기화
            const audioTrack =
              newStream.getAudioTracks()[0];
            if (audioTrack) {
              isAudioEnabled.value =
                audioTrack.enabled;
            }
          }
        },
        { immediate: true }
      );

      return {
        videoRef,
        isVideoReady,
        displayName,
        videoTrackCount,
        audioTrackCount,
        isStreamActive,
        trackStates,
        isVideoEnabled,
        isAudioEnabled,
        toggleVideo,
        toggleAudio,
      };
    },
  });
</script>

<style scoped>
  .video-participant {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
    border-radius: 8px;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .participant-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
  }

  .name {
    font-size: 14px;
    font-weight: 500;
  }

  .debug-info {
    font-size: 12px;
    opacity: 0.8;
  }

  .is-local video {
    transform: scaleX(-1);
  }

  .stream-controls {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 24px;
    z-index: 10;
  }

  .control-btn {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .control-btn.active {
    background: #4caf50;
  }

  .control-btn .icon {
    font-size: 20px;
  }

  .control-btn .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 12px;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
    margin-bottom: 8px;
  }

  .control-btn:hover .tooltip {
    opacity: 1;
    visibility: visible;
  }

  /* 호버 효과 */
  .control-btn:hover {
    transform: scale(1.1);
  }

  /* 클릭 효과 */
  .control-btn:active {
    transform: scale(0.95);
  }

  /* 비활성화 상태 스타일 */
  .control-btn:not(.active) {
    background: #f44336;
  }

  /* 반응형 디자인 */
  @media (max-width: 768px) {
    .stream-controls {
      bottom: 8px;
      padding: 4px;
    }

    .control-btn {
      width: 32px;
      height: 32px;
    }

    .control-btn .icon {
      font-size: 16px;
    }
  }
</style>
