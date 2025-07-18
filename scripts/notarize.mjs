/* eslint-disable @typescript-eslint/explicit-function-return-type */
// scripts/notarize.js
import { notarize } from '@electron/notarize'
import path from 'path'
import { execSync } from 'child_process'

export default async function ({ appOutDir, packager, electronPlatformName }) {
  if (electronPlatformName !== 'darwin') return

  const appName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  console.log('⏳ Submitting app for notarization…')
  await notarize({
    appBundleId: packager.appInfo.bundleIdentifier,
    appPath: appPath,
    // 在环境变量中设定苹果 ID 和 APP‑SPECIFIC 密码
    appleId: '13466564568@163.com',
    appleIdPassword: 'Beidou123'
    // 可选：如果使用 App Store Connect API Key，可改为
    // tool: 'notarytool',
    // apiKey: process.env.APPLE_API_KEY,
    // apiIssuer: process.env.APPLE_API_ISSUER
  })
  console.log('✅ Notarization completed, stapling ticket…')

  // Staple 公证票据
  execSync(`xcrun stapler staple "${appPath}"`)

  console.log('✅ Staple finished')
}
