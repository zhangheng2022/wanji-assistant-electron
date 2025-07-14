import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TARGET_DIR = path.resolve(__dirname, '../resources/libimobiledevice/mac')
const BINARIES = ['idevice_id', 'ideviceinfo', 'idevicesyslog', 'idevicepair', 'ideviceinstaller']

// 创建目标目录
fs.mkdirSync(TARGET_DIR, { recursive: true })

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function copyBinary(binary) {
  try {
    const src = execSync(`which ${binary}`).toString().trim()
    const dest = path.join(TARGET_DIR, binary)
    fs.copyFileSync(src, dest)
    fs.chmodSync(dest, 0o755)
    console.log(`✅ 拷贝 ${binary} 到 ${dest}`)

    // 复制依赖 dylib
    const otool = execSync(`otool -L "${src}"`).toString()
    const dylibPaths = otool
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split(' ')[0])
      .filter((p) => p.startsWith('/opt') || p.startsWith('/usr/local') || p.includes('Cellar'))

    dylibPaths.forEach((dylib) => {
      const dylibName = path.basename(dylib)
      const dylibDest = path.join(TARGET_DIR, dylibName)
      if (!fs.existsSync(dylibDest)) {
        fs.copyFileSync(dylib, dylibDest)
        fs.chmodSync(dylibDest, 0o755)
        console.log(`  └─ 拷贝依赖 ${dylibName}`)
      }
    })
  } catch (err) {
    console.warn(`⚠️  跳过 ${binary}：${err.message}`)
  }
}

BINARIES.forEach(copyBinary)
