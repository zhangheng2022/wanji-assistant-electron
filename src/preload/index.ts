import { contextBridge, ipcRenderer } from 'electron'

type Device = { id: string; info: Record<string, string> }

contextBridge.exposeInMainWorld('iOSDeviceAPI', {
  // 设备管理
  getConnectedDevices: () => ipcRenderer.invoke('get-connected-devices'),
  getDeviceInfo: (deviceId: string) => ipcRenderer.invoke('get-device-info', deviceId),

  // 应用管理
  installApp: (deviceId: string, ipaPath: string) =>
    ipcRenderer.invoke('install-app', deviceId, ipaPath),

  uninstallApp: (deviceId: string, bundleId: string) =>
    ipcRenderer.invoke('uninstall-app', deviceId, bundleId),

  getInstalledApps: (deviceId: string) => ipcRenderer.invoke('get-installed-apps', deviceId),

  // 设备操作
  takeScreenshot: (deviceId: string) => ipcRenderer.invoke('take-screenshot', deviceId),
  startDeviceLogs: (deviceId: string) => ipcRenderer.invoke('start-device-logs', deviceId),
  forwardPort: (deviceId: string, devicePort: number, localPort: number) =>
    ipcRenderer.invoke('forward-port', deviceId, devicePort, localPort),

  // 备份和恢复
  backupDevice: (deviceId: string) => ipcRenderer.invoke('backup-device', deviceId),
  restoreDevice: (deviceId: string) => ipcRenderer.invoke('restore-device', deviceId),

  // 设备控制
  rebootDevice: (deviceId: string) => ipcRenderer.invoke('reboot-device', deviceId),
  shutdownDevice: (deviceId: string) => ipcRenderer.invoke('shutdown-device', deviceId),

  // 事件监听
  onDeviceConnected: (callback: (device: Device) => void) => {
    ipcRenderer.on('device-connected', (_, device) => callback(device))
  },

  onDeviceDisconnected: (callback: (device: Device) => void) => {
    ipcRenderer.on('device-disconnected', (_, device) => callback(device))
  },

  onDeviceLog: (callback: (device: Device) => void) => {
    ipcRenderer.on('device-log', (_, logData) => callback(logData))
  },

  onBackupProgress: (callback: (device: Device) => void) => {
    ipcRenderer.on('backup-progress', (_, progress) => callback(progress))
  },

  onRestoreProgress: (callback: (device: Device) => void) => {
    ipcRenderer.on('restore-progress', (_, progress) => callback(progress))
  },

  // 移除事件监听
  removeAllListeners: (channel?: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
