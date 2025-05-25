<template>
  <div class="home-container">
    <div class="home-content">
      <h1>WebRTC 화상회의</h1>
      <p>mediasoup 기반 다자간 화상회의 시스템</p>

      <div class="join-options">
        <div class="join-room">
          <h2>기존 방 참여하기</h2>
          <form @submit.prevent="handleJoinRoom">
            <input
              type="text"
              v-model="roomId"
              placeholder="방 ID를 입력하세요"
              required
            />
            <button
              type="submit"
              class="join-button"
            >
              참여하기
            </button>
          </form>
        </div>

        <div class="create-room">
          <h2>새 방 만들기</h2>
          <button
            @click="handleCreateRoom"
            class="create-button"
          >
            새 방 생성
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  import { defineComponent, ref } from "vue";
  import { useRouter } from "vue-router";

  export default defineComponent({
    name: "Home",
    setup() {
      const roomId = ref("");
      const router = useRouter();

      const handleJoinRoom = () => {
        if (roomId.value.trim()) {
          router.push(`/room/${roomId.value}`);
        }
      };

      const handleCreateRoom = () => {
        // 랜덤 방 ID 생성
        const randomRoomId = Math.random()
          .toString(36)
          .substring(2, 8);
        router.push(`/room/${randomRoomId}`);
      };

      return {
        roomId,
        handleJoinRoom,
        handleCreateRoom,
      };
    },
  });
</script>

<style>
  @import "./Home.css";
</style>
