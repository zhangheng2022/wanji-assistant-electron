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

// 解析 otool -L 输出，返回依赖库路径数组（过滤系统库）
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
  try {
    execSync(`install_name_tool -change "${oldPath}" "${newPath}" "${binaryPath}"`)
    console.log(`🔧 修改依赖路径: ${oldPath} → ${newPath} (in ${path.basename(binaryPath)})`)
  } catch (err) {
    console.warn(
      `⚠️ 修改依赖路径失败: ${oldPath} → ${newPath} (in ${path.basename(binaryPath)})`,
      err.message
    )
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixAllDylibPaths(binaryPath) {
  const otool = execSync(`otool -L "${binaryPath}"`).toString()
  const deps = parseOtoolOutput(otool)

  deps.forEach((depPath) => {
    const dylibName = path.basename(depPath)
    const newPath = `@executable_path/${dylibName}`
    fixDylibPath(binaryPath, depPath, newPath)
  })
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function copyBinaryAndDeps(binary) {
  try {
    const src = execSync(`which ${binary}`).toString().trim()
    const dest = path.join(TARGET_DIR, binary)

    copyFileWithPermission(src, dest)

    // 修改主二进制文件的依赖路径
    fixAllDylibPaths(dest)

    // 复制依赖 dylib
    const otool = execSync(`otool -L "${src}"`).toString()
    const dylibPaths = parseOtoolOutput(otool)

    dylibPaths.forEach((dylib) => {
      const dylibName = path.basename(dylib)
      const dylibDest = path.join(TARGET_DIR, dylibName)
      if (!fs.existsSync(dylibDest)) {
        copyFileWithPermission(dylib, dylibDest)
        // 修改 dylib 本身的依赖路径
        fixAllDylibPaths(dylibDest)
      }
    })
  } catch (err) {
    console.warn(`⚠️ 跳过 ${binary}：${err.message}`)
  }
}

BINARIES.forEach(copyBinaryAndDeps)
