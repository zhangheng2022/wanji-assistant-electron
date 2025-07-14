/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TARGET_DIR = path.resolve(__dirname, '../resources/libimobiledevice/mac')
const BINARIES = ['idevice_id']

fs.mkdirSync(TARGET_DIR, { recursive: true })

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

function fixAllDylibPaths(binaryPath) {
  const output = execSync(`otool -L "${binaryPath}"`).toString()
  const deps = parseOtoolOutput(output)

  deps.forEach((dep) => {
    const name = path.basename(dep)
    const newPath = `@loader_path/${name}`
    fixDylibPath(binaryPath, dep, newPath)
  })
}

function copyBinaryAndFix(binary) {
  const src = execSync(`which ${binary}`).toString().trim()
  const dest = path.join(TARGET_DIR, binary)

  copyFileWithPermission(src, dest)

  // 查看复制后的依赖
  const otool = execSync(`otool -L "${dest}"`).toString()
  const dylibPaths = parseOtoolOutput(otool)

  dylibPaths.forEach((dylib) => {
    const name = path.basename(dylib)
    const destDylib = path.join(TARGET_DIR, name)
    if (!fs.existsSync(destDylib)) {
      copyFileWithPermission(dylib, destDylib)
    }
  })

  // 最后再修复 dest 可执行文件中的依赖路径
  fixAllDylibPaths(dest)
}

BINARIES.forEach(copyBinaryAndFix)
