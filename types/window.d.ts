import { ElectronAPI } from '@electron-toolkit/preload'

// 设备类型定义
type Device = {
  id: string
  info: Record<string, string>
}

// 应用信息类型
interface AppInfo {
  bundleId: string
  name: string
  version: string
  [key: string]: any
}

// 日志数据类型
interface LogData {
  deviceId: string
  timestamp: string
  level: string
  message: string
  [key: string]: any
}

// 备份进度类型
interface BackupProgress {
  deviceId: string
  percentage: number
  currentFile?: string
  totalFiles?: number
  processedFiles?: number
  status: 'started' | 'progress' | 'completed' | 'failed'
  message?: string
}

// 恢复进度类型
interface RestoreProgress {
  deviceId: string
  percentage: number
  currentFile?: string
  totalFiles?: number
  processedFiles?: number
  status: 'started' | 'progress' | 'completed' | 'failed'
  message?: string
}

// 端口转发选项
interface PortForwardOptions {
  devicePort: number
  localPort: number
}

// 截图选项
interface ScreenshotOptions {
  format?: 'png' | 'jpg'
  quality?: number
}

// iOS设备API接口定义
interface iOSDeviceAPI {
  // 设备管理
  getConnectedDevices(): Promise<Device[]>
  getDeviceInfo(deviceId: string): Promise<Record<string, string>>

  // 应用管理
  installApp(deviceId: string, ipaPath: string): Promise<boolean>
  uninstallApp(deviceId: string, bundleId: string): Promise<boolean>
  getInstalledApps(deviceId: string): Promise<AppInfo[]>

  // 设备操作
  takeScreenshot(deviceId: string): Promise<Buffer | string>
  startDeviceLogs(deviceId: string): Promise<boolean>
  forwardPort(deviceId: string, devicePort: number, localPort: number): Promise<boolean>

  // 备份和恢复
  backupDevice(deviceId: string): Promise<boolean>
  restoreDevice(deviceId: string): Promise<boolean>

  // 设备控制
  rebootDevice(deviceId: string): Promise<boolean>
  shutdownDevice(deviceId: string): Promise<boolean>

  // 事件监听
  onDeviceConnected(callback: (device: Device) => void): void
  onDeviceDisconnected(callback: (device: Device) => void): void
  onDeviceLog(callback: (logData: LogData) => void): void
  onBackupProgress(callback: (progress: BackupProgress) => void): void
  onRestoreProgress(callback: (progress: RestoreProgress) => void): void

  // 移除事件监听
  removeAllListeners(channel?: string): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    iOSDeviceAPI: iOSDeviceAPI
  }
}
