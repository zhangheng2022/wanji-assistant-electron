/* eslint-disable @typescript-eslint/explicit-function-return-type */
// scripts/afterPack.mjs
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import os from 'node:os'

const archDirs = ['mac-arm64', 'mac-x86']

export default async function afterPack(context) {
  console.log('🔧 执行 afterPack 脚本...', context.appOutDir)
  if (os.platform() !== 'darwin') {
    console.warn('⚠️ 仅在 macOS 上执行 afterPack 脚本')
    return
  }
  for (const arch of archDirs) {
    const unpackedDir = path.join(
      context.appOutDir,
      'wanjizhushou.app',
      'Contents',
      'Resources',
      `app.asar.unpacked/resources/libimobiledevice/${arch}`
    )

    if (!fs.existsSync(unpackedDir)) {
      console.warn(`⚠️ 未找到目录: ${unpackedDir}`)
      continue
    }

    const files = fs.readdirSync(unpackedDir)
    for (const file of files) {
      const fullPath = path.join(unpackedDir, file)
      try {
        execSync(`chmod +x "${fullPath}"`)
        console.log(`✅ chmod +x: ${fullPath}`)
      } catch (err) {
        console.warn(`❌ 设置执行权限失败: ${fullPath}`, err.message)
      }
      try {
        execSync(`codesign --force --sign - "${fullPath}"`)
        console.log(`🔏 已签名: ${fullPath}`)
      } catch (err) {
        console.warn(`❌ 签名失败: ${fullPath}`, err.message)
      }
    }
  }
}
