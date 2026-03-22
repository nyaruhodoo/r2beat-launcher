import './assets/css/index.css'
import { createApp } from 'vue'
import App from './App.vue'
import AnnouncementDetailWindow from './AnnouncementDetailWindow.vue'
import ShippingAssistant from './ShippingAssistantWindow/index.vue'

const params = new URLSearchParams(window.location.search)
const windowType = params.get('windowType') as 'announcementDetail' | 'shippingAssistant' | null

const componentMap = {
  announcementDetail: AnnouncementDetailWindow,
  shippingAssistant: ShippingAssistant,
}

const RootComponent = windowType ? componentMap[windowType] : App

const app = createApp(RootComponent)
app.mount('#app')
