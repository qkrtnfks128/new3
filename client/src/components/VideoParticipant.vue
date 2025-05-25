<template>
  <div
    class="video-participant"
    :class="{ local: isLocal, remote: !isLocal }"
  >
    <video
      ref="videoRef"
      autoplay
      playsInline
      :muted="isLocal"
    />
    <div class="peer-id">
      {{ isLocal ? "나" : peerId }}
    </div>
  </div>
</template>

<script lang="ts">
  import {
    defineComponent,
    ref,
    onMounted,
    watch,
    PropType,
  } from "vue";

  export default defineComponent({
    name: "VideoParticipant",
    props: {
      stream: {
        type: Object as PropType<MediaStream>,
        required: true,
      },
      peerId: {
        type: String,
        required: true,
      },
      isLocal: {
        type: Boolean,
        default: false,
      },
    },
    setup(props) {
      const videoRef =
        ref<HTMLVideoElement | null>(null);

      const setVideoStream = () => {
        if (videoRef.value && props.stream) {
          videoRef.value.srcObject = props.stream;

          // 비디오 자동 재생을 위한 명시적 play 호출
          if (!props.isLocal) {
            videoRef.value.play().catch((err) => {
              console.error(
                "비디오 재생 실패:",
                err
              );
            });
          }
        }
      };

      onMounted(() => {
        setVideoStream();
      });

      watch(
        () => props.stream,
        () => {
          setVideoStream();
        }
      );

      return {
        videoRef,
      };
    },
  });
</script>

<style>
  /* 스타일은 VideoRoom.css에서 관리 */
</style>
