import { createApp } from "vue";
import {
  createRouter,
  createWebHistory,
} from "vue-router";
import { createPinia } from "pinia";
import App from "./App.vue";
import Home from "./components/Home.vue";
import VideoRoom from "./components/VideoRoom.vue";
import "./index.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    {
      path: "/room/:roomId",
      component: VideoRoom,
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

const pinia = createPinia();
const app = createApp(App);

app.use(router);
app.use(pinia);
app.mount("#app");
