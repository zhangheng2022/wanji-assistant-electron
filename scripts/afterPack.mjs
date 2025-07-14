// scripts/afterPack.mjs
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async function afterPack(context) {
  console.log('🔧 执行 afterPack 脚本...', context.appOutDir)

  const unpackedDir = path.join(
    context.appOutDir,
    '万机助手.app',
    'Contents',
    'Resources',
    'app.asar.unpacked/resources/libimobiledevice/mac'
  )

  if (!fs.existsSync(unpackedDir)) {
    console.warn('⚠️ 未找到 libimobiledevice/mac 目录:', unpackedDir)
    return
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
  }
}
