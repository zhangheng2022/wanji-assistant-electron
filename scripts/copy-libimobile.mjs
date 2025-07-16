/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BINARIES = ['idevice_id', 'ideviceinfo', 'idevicesyslog', 'idevicepair', 'idevicediagnostics']

const archArg = process.argv.find((arg) => arg.startsWith('--arch='))
const arch = archArg ? archArg.split('=')[1] : 'native'

if (!['arm64', 'x86'].includes(arch)) {
  console.error(`❌ 无效的架构参数: ${arch}，应为 --arch=arm64 或 --arch=x86`)
  process.exit(1)
}

const TARGET_DIR = path.resolve(__dirname, `../resources/libimobiledevice/mac-${arch}`)
fs.mkdirSync(TARGET_DIR, { recursive: true })

function run(cmd) {
  const archCmd = arch === 'x86' ? `arch -x86_64 ${cmd}` : `arch -arm64 ${cmd}`
  return execSync(archCmd).toString().trim()
}

function copyFileWithPermission(src, dest) {
  fs.copyFileSync(src, dest)
  fs.chmodSync(dest, 0o755)
  console.log(`✅ 拷贝并设置权限: ${dest}`)
}

function parseOtoolOutput(otoolOutput) {
  return otoolOutput
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(' ')[0])
    .filter((p) => p && !p.startsWith('/usr/lib/') && !p.startsWith('/System/Library/'))
}

function fixDylibPath(binaryPath, oldPath, newPath) {
  try {
    execSync(`install_name_tool -change "${oldPath}" "${newPath}" "${binaryPath}"`)
    console.log(`🔧 修改依赖路径: ${oldPath} → ${newPath}`)
  } catch (err) {
    console.warn(`❌ 修改失败: ${oldPath} → ${newPath}`, err.message)
  }
}

const fixedDylibs = new Set()

function fixAllDylibPaths(binaryPath) {
  const output = execSync(`otool -L "${binaryPath}"`).toString()
  const deps = parseOtoolOutput(output)

  deps.forEach((dep) => {
    const name = path.basename(dep)
    const newPath = `@loader_path/${name}`
    const destDylib = path.join(TARGET_DIR, name)

    // 如果依赖尚未处理过
    if (!fixedDylibs.has(dep)) {
      fixedDylibs.add(dep)

      if (!fs.existsSync(destDylib)) {
        try {
          if (fs.existsSync(dep)) {
            copyFileWithPermission(dep, destDylib)
            fixAllDylibPaths(destDylib) // 递归处理 dylib 的依赖
          } else {
            console.warn(`⚠️ 依赖路径不存在: ${dep}`)
          }
        } catch (err) {
          console.warn(`❌ 拷贝依赖失败: ${dep}`, err.message)
        }
      }
    }

    fixDylibPath(binaryPath, dep, newPath)
  })
}

function copyBinaryAndFix(binary) {
  try {
    const src = run(`which ${binary}`)
    const dest = path.join(TARGET_DIR, binary)

    copyFileWithPermission(src, dest)
    fixAllDylibPaths(dest)
  } catch (err) {
    console.warn(`⚠️ 处理 ${binary} 失败:`, err.message)
  }
}

BINARIES.forEach(copyBinaryAndFix)
