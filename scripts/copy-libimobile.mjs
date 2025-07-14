import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TARGET_DIR = path.resolve(__dirname, '../resources/libimobiledevice/mac')
const BINARIES = ['idevice_id', 'ideviceinfo', 'idevicesyslog', 'idevicepair', 'ideviceinstaller']

fs.mkdirSync(TARGET_DIR, { recursive: true })

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function copyFileWithPermission(src, dest) {
  fs.copyFileSync(src, dest)
  fs.chmodSync(dest, 0o755)
  console.log(`✅ 拷贝并设置权限: ${dest}`)
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function parseOtoolOutput(otoolOutput) {
  return otoolOutput
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(' ')[0])
    .filter((p) => p && !p.startsWith('/usr/lib/') && !p.startsWith('/System/Library/'))
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixDylibPath(binaryPath, oldPath, newPath) {
  if (oldPath === newPath) return
  try {
    console.log(`🛠️ 正在修改: ${binaryPath} 中 ${oldPath} → ${newPath}`)
    execSync(`install_name_tool -change "${oldPath}" "${newPath}" "${binaryPath}"`)
    console.log(`🔧 成功修改依赖路径`)
  } catch (err) {
    console.error(`❌ 修改失败: ${oldPath} → ${newPath} in ${binaryPath}`)
    console.error('错误信息:', err.message)
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixAllDylibPaths(binaryPath) {
  const otoolOutput = execSync(`otool -L "${binaryPath}"`).toString()
  const deps = parseOtoolOutput(otoolOutput)

  deps.forEach((depPath) => {
    const dylibName = path.basename(depPath)
    const newPath = `@loader_path/${dylibName}`
    fixDylibPath(binaryPath, depPath, newPath)
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function copyBinaryAndDeps(binary) {
  try {
    const src = execSync(`which ${binary}`).toString().trim()
    const dest = path.join(TARGET_DIR, binary)

    copyFileWithPermission(src, dest)

    // 修改主可执行文件依赖
    fixAllDylibPaths(dest)

    // 复制并修复依赖库
    const otool = execSync(`otool -L "${src}"`).toString()
    const dylibPaths = parseOtoolOutput(otool)

    dylibPaths.forEach((dylib) => {
      const dylibName = path.basename(dylib)
      const dylibDest = path.join(TARGET_DIR, dylibName)
      if (!fs.existsSync(dylibDest)) {
        copyFileWithPermission(dylib, dylibDest)
        fixAllDylibPaths(dylibDest)
      }
    })
  } catch (err) {
    console.warn(`⚠️ 跳过 ${binary}：${err.message}`)
  }
}

BINARIES.forEach(copyBinaryAndDeps)
