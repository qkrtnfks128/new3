<template>
  <div class="app">
    <router-view />
  </div>
</template>

<script lang="ts">
  import { defineComponent } from "vue";

  export default defineComponent({
    name: "App",
  });
</script>

<style>
  @import "./App.css";
</style>
