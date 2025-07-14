import { join } from 'path'
import { existsSync, readdirSync } from 'fs'
import { execSync } from 'child_process'

export const appId = 'com.tengwei.wanjisass'
export const productName = '万机助手'
export const directories = {
  buildResources: 'build'
}
export const files = [
  '!**/.vscode/*',
  '!src/*',
  '!electron.vite.config.{js,ts,mjs,cjs}',
  '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
  '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
  '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'
]
export const asarUnpack = ['resources/**']
export const win = {
  requestedExecutionLevel: 'requireAdministrator',
  target: 'msi'
}
export const msi = {
  additionalLightArgs: ['-cultures:zh-CN'],
  artifactName: '${name}-${version}.${ext}',
  createDesktopShortcut: 'always',
  createStartMenuShortcut: true,
  perMachine: true,
  oneClick: false,
  runAfterFinish: false
}
export const mac = {
  entitlementsInherit: 'build/entitlements.mac.plist',
  extendInfo: {
    NSCameraUsageDescription: "Application requests access to the device's camera.",
    NSMicrophoneUsageDescription: "Application requests access to the device's microphone.",
    NSDocumentsFolderUsageDescription:
      "Application requests access to the user's Documents folder.",
    NSDownloadsFolderUsageDescription: "Application requests access to the user's Downloads folder."
  },
  notarize: false
}
export const dmg = {
  artifactName: '${name}-${version}.${ext}'
}
export const linux = {
  target: ['AppImage', 'snap', 'deb'],
  maintainer: 'electronjs.org',
  category: 'Utility'
}
export const appImage = {
  artifactName: '${name}-${version}.${ext}'
}
export const npmRebuild = false
export const publish = {
  provider: 'generic',
  url: 'https://example.com/auto-updates'
}
export async function afterPack(context) {
  const unpackedMacBin = join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'resources',
    'libimobiledevice',
    'mac'
  )

  if (!existsSync(unpackedMacBin)) return

  const files = readdirSync(unpackedMacBin)
  for (const file of files) {
    const fullPath = join(unpackedMacBin, file)
    try {
      execSync(`chmod +x "${fullPath}"`)
      console.log(`✅ 添加执行权限: ${fullPath}`)
    } catch (err) {
      console.warn(`❌ 设置权限失败: ${fullPath}`, err.message)
    }
  }
}
