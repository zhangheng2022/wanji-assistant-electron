import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

module.exports = async function (context) {
  const unpackedBinDir = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'resources',
    'libimobiledevice',
    'mac'
  )

  if (!fs.existsSync(unpackedBinDir)) {
    console.warn('⚠️ 没有找到 mac 可执行目录:', unpackedBinDir)
    return
  }

  const files = fs.readdirSync(unpackedBinDir)
  for (const file of files) {
    const fullPath = path.join(unpackedBinDir, file)
    try {
      execSync(`chmod +x "${fullPath}"`)
      console.log(`✅ 添加执行权限: ${fullPath}`)
    } catch (err) {
      console.warn(`❌ 无法设置权限: ${fullPath}`, err.message)
    }
  }
}
