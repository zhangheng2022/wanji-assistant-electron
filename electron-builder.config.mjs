// electron-builder.config.mjs
import afterPack from './scripts/afterPack.mjs'

export default {
  appId: 'com.tengwei.wanjisass',
  productName: '万机助手',
  directories: {
    buildResources: 'build'
  },
  files: [
    '!**/.vscode/*',
    '!src/*',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
    '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
    '!**/Resources/**/*.pak'
  ],
  asarUnpack: ['resources/**'],
  win: {
    requestedExecutionLevel: 'highestAvailable',
    target: 'msi'
  },
  msi: {
    additionalLightArgs: ['-cultures:zh-CN'],
    artifactName: '${name}-${version}.${ext}',
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    perMachine: true,
    oneClick: false,
    runAfterFinish: false
  },
  mac: {
    identity: 'Hangzhou TENGWEI Technology Co., Ltd (Z7B5LMFWHJ)',
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    gatekeeperAssess: false,
    notarize: false
  },
  dmg: {
    artifactName: '${name}-${version}.${ext}'
  },
  linux: {
    target: ['AppImage', 'snap', 'deb'],
    maintainer: 'electronjs.org',
    category: 'Utility'
  },
  appImage: {
    artifactName: '${name}-${version}.${ext}'
  },
  npmRebuild: false,
  publish: {
    provider: 'generic',
    url: 'https://example.com/auto-updates'
  },
  afterPack: afterPack
}
