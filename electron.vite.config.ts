import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      vue(), // 原子化 CSS
      UnoCSS(),
      // 自动按需导入 API
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia'],
        dts: resolve(__dirname, 'types/auto/auto-imports.d.ts'),
        eslintrc: {
          enabled: true, // 自动生成 .eslintrc-auto-import.json
          filepath: './.eslintrc-auto-import.json',
          globalsPropValue: 'readonly'
        },
        resolvers: [ElementPlusResolver()]
      }),
      // 自动按需导入组件
      Components({
        dts: resolve(__dirname, 'types/auto/components.d.ts'),
        resolvers: [ElementPlusResolver()]
      })
    ]
  }
})
