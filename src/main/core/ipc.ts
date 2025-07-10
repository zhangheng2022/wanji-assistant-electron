import DeviceManager from '.'
import { ipcMain } from 'electron'

// 设置 IPC 处理程序
export function setupIpcHandlers(deviceManager: DeviceManager): void {
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

  // // 安装应用
  // ipcMain.handle('install-app', async (_, deviceId, ipaPath) => {
  //   try {
  //     if (!ipaPath) {
  //       // 显示文件选择对话框
  //       const result = await dialog.showOpenDialog(mainWindow, {
  //         properties: ['openFile'],
  //         filters: [{ name: 'iOS App', extensions: ['ipa'] }]
  //       })

  //       if (result.canceled) {
  //         return { success: false, error: '用户取消了操作' }
  //       }

  //       ipaPath = result.filePaths[0]
  //     }

  //     await deviceManager.installApp(deviceId, ipaPath)
  //     return { success: true }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 卸载应用
  // ipcMain.handle('uninstall-app', async (_, deviceId, bundleId) => {
  //   try {
  //     await deviceManager.uninstallApp(deviceId, bundleId)
  //     return { success: true }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 获取已安装应用列表
  // ipcMain.handle('get-installed-apps', async (_, deviceId) => {
  //   try {
  //     return await deviceManager.getInstalledApps(deviceId)
  //   } catch (error) {
  //     throw new Error(`获取应用列表失败: ${(error as Error)?.message || String(error)}`)
  //   }
  // })

  // // 截屏
  // ipcMain.handle('take-screenshot', async (_, deviceId) => {
  //   try {
  //     const result = await dialog.showSaveDialog(mainWindow, {
  //       defaultPath: `screenshot_${Date.now()}.png`,
  //       filters: [{ name: 'PNG Image', extensions: ['png'] }]
  //     })

  //     if (result.canceled) {
  //       return { success: false, error: '用户取消了操作' }
  //     }

  //     await deviceManager.takeScreenshot(deviceId, result.filePath)
  //     return { success: true, path: result.filePath }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 开始获取设备日志
  // ipcMain.handle('start-device-logs', async (_, deviceId) => {
  //   try {
  //     await deviceManager.getDeviceLogs(deviceId)
  //     return { success: true }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 端口转发
  // ipcMain.handle('forward-port', async (_, deviceId, devicePort, localPort) => {
  //   try {
  //     await deviceManager.forwardPort(deviceId, devicePort, localPort)
  //     return { success: true }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 备份设备
  // ipcMain.handle('backup-device', async (_, deviceId) => {
  //   try {
  //     const result = await dialog.showOpenDialog(mainWindow, {
  //       properties: ['openDirectory']
  //     })

  //     if (result.canceled) {
  //       return { success: false, error: '用户取消了操作' }
  //     }

  //     const backupPath = path.join(result.filePaths[0], `backup_${deviceId}_${Date.now()}`)
  //     await deviceManager.backupDevice(deviceId, backupPath)
  //     return { success: true, path: backupPath }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 恢复设备
  // ipcMain.handle('restore-device', async (_, deviceId) => {
  //   try {
  //     const result = await dialog.showOpenDialog(mainWindow, {
  //       properties: ['openDirectory']
  //     })

  //     if (result.canceled) {
  //       return { success: false, error: '用户取消了操作' }
  //     }

  //     await deviceManager.restoreDevice(deviceId, result.filePaths[0])
  //     return { success: true }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 重启设备
  // ipcMain.handle('reboot-device', async (_, deviceId) => {
  //   try {
  //     await deviceManager.rebootDevice(deviceId)
  //     return { success: true }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })

  // // 关机设备
  // ipcMain.handle('shutdown-device', async (_, deviceId) => {
  //   try {
  //     await deviceManager.shutdownDevice(deviceId)
  //     return { success: true }
  //   } catch (error) {
  //     return { success: false, error: (error as Error)?.message || String(error) }
  //   }
  // })
}
