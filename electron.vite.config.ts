import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src'),
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      vue(), // 原子化 CSS
      UnoCSS(),
      // 自动按需导入 API
      AutoImport({
        imports: ['vue'],
        dts: '../../../types/auto/auto-imports.d.ts',
        resolvers: [ElementPlusResolver()]
      }),
      // 自动按需导入组件
      Components({
        dts: '../../../types/auto/components.d.ts',
        resolvers: [ElementPlusResolver()]
      })
    ]
  }
})
