/// <reference types="vite/client" />

/** 声明 vite 环境变量的类型（如果未声明则默认是 any） */
interface ImportMetaEnv {
  readonly MAIN_VITE_SOME_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
