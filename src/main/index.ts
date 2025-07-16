import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import DeviceManager from './core' // Adjust the import path as necessary
import icon from '../../resources/images/icon.png?asset'

let deviceManager: DeviceManager
let mainWindow: BrowserWindow

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 开发模式下打开开发者工具
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools()
  // }
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  log.initialize()
  console.log = log.log
  console.error = log.error
  console.warn = log.warn
  console.info = log.info
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
    app.setName('万机助手')
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  // 初始化 iOS 设备管理器
  deviceManager = new DeviceManager()
  try {
    await deviceManager.initialize()
    console.log('设备管理器初始化成功')
  } catch (error) {
    console.error('设备管理器初始化失败:', error)
    // 显示错误对话框
    dialog.showErrorBox(
      '初始化失败',
      'libimobiledevice 未安装或配置错误。请确保已正确安装 libimobiledevice。'
    )
  }

  // 监听设备事件
  setupDeviceEventListeners()

  // 设置 IPC 处理程序
  setupIpcHandlers()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// 设置设备事件监听器
function setupDeviceEventListeners(): void {
  deviceManager.on('deviceConnected', (device) => {
    // 发送到渲染进程
    if (mainWindow) {
      mainWindow.webContents.send('device-connected', device)
    }
  })

  deviceManager.on('deviceDisconnected', (device) => {
    // 发送到渲染进程
    if (mainWindow) {
      mainWindow.webContents.send('device-disconnected', device)
    }
  })

  deviceManager.on('deviceLog', (logData) => {
    // 发送日志到渲染进程
    if (mainWindow) {
      mainWindow.webContents.send('device-log', logData)
    }
  })

  deviceManager.on('backupProgress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('backup-progress', progress)
    }
  })

  deviceManager.on('restoreProgress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('restore-progress', progress)
    }
  })
}

// 设置 IPC 处理程序
function setupIpcHandlers(): void {
  // 获取连接的设备列表
  ipcMain.handle('get-connected-devices', () => {
    return deviceManager.getConnectedDeviceList()
  })

  // 获取设备信息
  ipcMain.handle('get-device-info', async (_, deviceId) => {
    try {
      return await deviceManager.getDeviceInfo(deviceId)
    } catch (error) {
      throw new Error(`获取设备信息失败: ${(error as Error)?.message || String(error)}`)
    }
  })

  // 安装应用
  ipcMain.handle('install-app', async (_, deviceId, ipaPath) => {
    try {
      if (!ipaPath) {
        // 显示文件选择对话框
        const result = await dialog.showOpenDialog(mainWindow, {
          properties: ['openFile'],
          filters: [{ name: 'iOS App', extensions: ['ipa'] }]
        })

        if (result.canceled) {
          return { success: false, error: '用户取消了操作' }
        }

        ipaPath = result.filePaths[0]
      }

      await deviceManager.installApp(deviceId, ipaPath)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 卸载应用
  ipcMain.handle('uninstall-app', async (_, deviceId, bundleId) => {
    try {
      await deviceManager.uninstallApp(deviceId, bundleId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 获取已安装应用列表
  ipcMain.handle('get-installed-apps', async (_, deviceId) => {
    try {
      return await deviceManager.getInstalledApps(deviceId)
    } catch (error) {
      throw new Error(`获取应用列表失败: ${(error as Error)?.message || String(error)}`)
    }
  })

  // 截屏
  ipcMain.handle('take-screenshot', async (_, deviceId) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `screenshot_${Date.now()}.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      })

      if (result.canceled) {
        return { success: false, error: '用户取消了操作' }
      }

      await deviceManager.takeScreenshot(deviceId, result.filePath)
      return { success: true, path: result.filePath }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 开始获取设备日志
  ipcMain.handle('start-device-logs', async (_, deviceId) => {
    try {
      await deviceManager.getDeviceLogs(deviceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 端口转发
  ipcMain.handle('forward-port', async (_, deviceId, devicePort, localPort) => {
    try {
      await deviceManager.forwardPort(deviceId, devicePort, localPort)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 备份设备
  ipcMain.handle('backup-device', async (_, deviceId) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return { success: false, error: '用户取消了操作' }
      }

      const backupPath = path.join(result.filePaths[0], `backup_${deviceId}_${Date.now()}`)
      await deviceManager.backupDevice(deviceId, backupPath)
      return { success: true, path: backupPath }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 恢复设备
  ipcMain.handle('restore-device', async (_, deviceId) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
      })

      if (result.canceled) {
        return { success: false, error: '用户取消了操作' }
      }

      await deviceManager.restoreDevice(deviceId, result.filePaths[0])
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 重启设备
  ipcMain.handle('reboot-device', async (_, deviceId) => {
    try {
      await deviceManager.rebootDevice(deviceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })

  // 关机设备
  ipcMain.handle('shutdown-device', async (_, deviceId) => {
    try {
      await deviceManager.shutdownDevice(deviceId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error)?.message || String(error) }
    }
  })
}
