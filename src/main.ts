/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'
import { createPinia } from 'pinia'
import '@/styles/volca.css'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'
import { i18n } from '@/i18n'

const app = createApp(App)
const pinia = createPinia()

registerPlugins(app)
app.use(pinia)
app.use(i18n)

app.mount('#app')
