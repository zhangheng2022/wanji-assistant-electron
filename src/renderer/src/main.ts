import { createApp } from 'vue'
import App from './App.vue'

// 引入全局样式
import 'virtual:uno.css'

// 创建应用实例
const app = createApp(App)

import { installPlugins } from '@renderer/plugins'
// 安装插件（全局组件、自定义指令等）
installPlugins(app)

app.mount('#app')
