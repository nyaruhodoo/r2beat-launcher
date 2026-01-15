import './assets/css/index.css'
import { createApp } from 'vue'
import App from './App.vue'
import AnnouncementDetailWindow from './AnnouncementDetailWindow.vue'

const params = new URLSearchParams(window.location.search)
const windowType = params.get('windowType')

const RootComponent = windowType === 'announcementDetail' ? AnnouncementDetailWindow : App

// 创建并挂载应用
const app = createApp(RootComponent)
app.mount('#app')
