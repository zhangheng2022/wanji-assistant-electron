import type { ChildProcessWithoutNullStreams } from 'child_process'
import { spawn, exec } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import { listenToUsbmuxd } from './usbmuxd'
import { ensureServiceRunning } from '../utils/service-running'
import { log } from 'console'

interface DeviceInfo {
  id: string
  info: Record<string, string>
  status: number // 1: 连接中, 2: 已连接, 3: 等待信任, 4: 信任失败, 5: 已配对
}

class WinDeviceManager extends EventEmitter {
  devices: Map<string, DeviceInfo>
  isMonitoring: boolean
  libimobiledevicePath: string
  private waitTrustMap = new Map<string, (result: boolean) => void>()
  private deviceStatusMap = new Map<string, number>()

  constructor() {
    super()
    this.devices = new Map()
    this.isMonitoring = false
    this.libimobiledevicePath = this.findLibimobiledevicePath()
  }

  findLibimobiledevicePath(): string {
    // 根据平台返回不同的路径
    const platform = process.platform
    if (platform === 'win32') {
      return join(__dirname, '../../resources/libimobiledevice/win-x64')
    } else if (platform === 'darwin') {
      return '/usr/local/bin'
    } else {
      return '/usr/bin'
    }
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('初始化 iOS 设备管理器...')
      // 检查 libimobiledevice 是否已安装
      await this.checkLibimobiledevice()

      // 启动设备监控
      await this.startDeviceMonitoring()

      console.log('iOS 设备管理器初始化成功')
      return true
    } catch (error) {
      console.error('初始化失败:', error)
      return false
    }
  }

  async checkLibimobiledevice(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(`${this.libimobiledevicePath}/idevice_id --version`, (error, stdout) => {
        if (error) {
          reject(`libimobiledevice 未安装或未配置正确: ${error.message}`)
        } else {
          console.log('libimobiledevice 版本:', stdout.trim())
          resolve()
        }
      })
    })
  }

  async startDeviceMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('设备监控已在运行')
      return
    }

    await ensureServiceRunning('Apple Mobile Device Service')

    listenToUsbmuxd(async (data) => {
      const { MessageType, Properties } = data
      const deviceId = Properties?.SerialNumber

      // 设备插入
      if (MessageType === 'Attached') {
        if (!deviceId) {
          console.warn('设备未提供序列号，无法处理')
          return
        }
        console.log(`设备 ${deviceId} 已连接`)
        this.deviceStatusMap.set(deviceId, 1) // 连接中
        this.updateDeviceStatus(deviceId, 1)
        // 延迟3秒后检查设备状态
        setTimeout(async () => {
          this.deviceStatusMap.set(deviceId, 3) // 等待信任
          this.updateDeviceStatus(deviceId, 3)
          // 等待设备信任
          const paired = await this.waitForTrust(deviceId, 10000)
          if (paired) {
            this.deviceStatusMap.set(deviceId, 5) // 已配对
            this.updateDeviceStatus(deviceId, 5)
          } else {
            console.warn(`设备 ${deviceId} 未完成信任`)
            this.deviceStatusMap.set(deviceId, 4) // 信任失败
            this.updateDeviceStatus(deviceId, 4)
          }
        }, 3000)
      }

      // 设备已配对（提前结束 waitForTrust）
      if (MessageType === 'Paired') {
        if (!deviceId) {
          console.warn('设备未提供序列号，无法处理')
          return
        }
        console.log(`设备 ${deviceId} 已配对`)
        const resolver = this.waitTrustMap.get(deviceId)
        if (resolver) {
          resolver(true)
        }
        this.deviceStatusMap.set(deviceId, 5) // 已配对
        this.updateDeviceStatus(deviceId, 5)
      }

      // 设备断开
      if (MessageType === 'Detached') {
        this.updateDeviceList()
      }
    })

    this.isMonitoring = true
  }

  // 更新设备状态并获取设备信息
  private async updateDeviceStatus(deviceId: string, status: number): Promise<void> {
    try {
      const existingDevice = this.devices.get(deviceId)
      let deviceInfo: Record<string, string> = existingDevice?.info || {}

      // 只有在设备已配对时才获取详细信息
      if (status === 5 && (!existingDevice || existingDevice.status !== 5)) {
        try {
          const info = await this.getDeviceInfo(deviceId)
          log(`获取设备信息 (${deviceId}):`, info)
          deviceInfo = {
            DeviceName: info.DeviceName || '未知设备',
            ProductVersion: info.ProductVersion || '未知版本',
            ModelNumber: info.ModelNumber || '未知型号',
            DeviceColor: info.DeviceColor || '未知颜色'
          }
        } catch (error) {
          console.error(`获取设备信息失败 (${deviceId}):`, error)
          deviceInfo = existingDevice?.info || {}
        }
      }

      const device: DeviceInfo = {
        id: deviceId,
        info: deviceInfo,
        status
      }
      this.devices.set(deviceId, device)
      this.emit('deviceConnected', device)
    } catch (error) {
      console.error(`更新设备状态失败 (${deviceId}):`, error)
    }
  }

  // 获取当前连接的设备列表
  async getConnectedDevices(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      exec(`${this.libimobiledevicePath}/idevice_id -l`, (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        const deviceIds = stdout
          .trim()
          .split('\n')
          .filter((id) => id.length > 0)
        resolve(deviceIds)
      })
    })
  }

  private async waitForTrust(deviceId: string, timeout = 10000): Promise<boolean> {
    const interval = 1000 // 每秒轮询一次
    const maxTries = Math.floor(timeout / interval)
    return new Promise((resolve) => {
      let count = 0
      const timer = setInterval(async () => {
        count++
        // 检查是否已信任
        const paired = await this.isDevicePaired(deviceId)
        if (paired) {
          clearInterval(timer)
          this.waitTrustMap.delete(deviceId)
          resolve(true)
          return
        }
        if (count >= maxTries) {
          clearInterval(timer)
          this.waitTrustMap.delete(deviceId)
          resolve(false)
        }
      }, interval)
      // 注册 resolver，用于外部提前触发（如监听到 Paired）
      this.waitTrustMap.set(deviceId, (result) => {
        clearInterval(timer)
        this.waitTrustMap.delete(deviceId)
        resolve(result)
      })
    })
  }

  // 获取设备配对状态
  async isDevicePaired(deviceId: string): Promise<boolean> {
    return new Promise((resolve) => {
      exec(`${this.libimobiledevicePath}/idevicepair -u ${deviceId} validate`, (error, stdout) => {
        if (error) {
          resolve(false)
          return
        }
        // 如果输出包含 "SUCCESS" 则表示设备已配对
        const isPaired = stdout.includes('SUCCESS')
        resolve(isPaired)
      })
    })
  }

  // 获取设备信息
  async getDeviceInfo(deviceId: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      exec(`${this.libimobiledevicePath}/ideviceinfo -u ${deviceId}`, (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        const info = {}
        const lines = stdout.split('\n')
        lines.forEach((line) => {
          const [key, value] = line.split(': ')
          if (key && value) {
            info[key.trim()] = value.trim()
          }
        })
        resolve(info)
      })
    })
  }

  // 更新设备列表 - 现在主要用于初始化时同步已连接的设备
  async updateDeviceList(): Promise<void> {
    try {
      const currentDevices = await this.getConnectedDevices()
      const previousDevices = Array.from(this.devices.keys())

      // 检查新连接的设备（初始化时）
      for (const deviceId of currentDevices) {
        if (!this.devices.has(deviceId)) {
          try {
            // 检查设备是否已配对
            const paired = await this.isDevicePaired(deviceId)
            const status = paired ? 5 : 3 // 已配对或等待信任
            this.deviceStatusMap.set(deviceId, status)
            await this.updateDeviceStatus(deviceId, status)
            console.log(`发现已连接设备: ${deviceId}`)
          } catch (error) {
            console.error(`处理设备失败 (${deviceId}):`, error)
          }
        }
      }

      // 检查断开连接的设备
      for (const deviceId of previousDevices) {
        if (!currentDevices.includes(deviceId)) {
          const deviceInfo = this.devices.get(deviceId)
          this.devices.delete(deviceId)
          this.deviceStatusMap.delete(deviceId)
          this.emit('deviceDisconnected', { id: deviceId, info: deviceInfo })
        }
      }
    } catch (error) {
      console.error('更新设备列表失败:', error)
    }
  }

  async installApp(deviceId: string, ipaPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `${this.libimobiledevicePath}/ideviceinstaller -u ${deviceId} -i "${ipaPath}"`
      const process = spawn('sh', ['-c', cmd], { stdio: 'pipe' })
      let output = ''
      let errorOutput = ''
      process.stdout.on('data', (data) => {
        output += data.toString()
        console.log(data.toString())
      })
      process.stderr.on('data', (data) => {
        errorOutput += data.toString()
        console.error(data.toString())
      })
      process.on('close', (code) => {
        if (code === 0) {
          resolve(output)
        } else {
          reject(new Error(`应用安装失败: ${errorOutput}`))
        }
      })
    })
  }

  async uninstallApp(deviceId: string, bundleId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `ideviceinstaller -u ${deviceId} -U ${bundleId}`
      exec(cmd, (error, stdout) => {
        if (error) {
          reject(error)
        } else {
          resolve(stdout)
        }
      })
    })
  }

  async getInstalledApps(deviceId: string): Promise<{ bundleId: string; name: string }[]> {
    return new Promise((resolve, reject) => {
      exec(`ideviceinstaller -u ${deviceId} -l`, (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        const apps: { bundleId: string; name: string }[] = []
        const lines = stdout.split('\n')
        lines.forEach((line) => {
          const match = line.match(/^(.+?) - (.+?)$/)
          if (match) {
            apps.push({
              bundleId: match[1].trim(),
              name: match[2].trim()
            })
          }
        })
        resolve(apps)
      })
    })
  }

  async takeScreenshot(deviceId: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `idevicescreenshot -u ${deviceId} "${outputPath}"`
      exec(cmd, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve(outputPath)
        }
      })
    })
  }

  async getDeviceLogs(deviceId: string): Promise<string | ChildProcessWithoutNullStreams> {
    return new Promise((resolve) => {
      const process = spawn(`${this.libimobiledevicePath}/idevicesyslog`, ['-u', deviceId])
      let logs = ''
      process.stdout.on('data', (data) => {
        logs += data.toString()
        this.emit('deviceLog', { deviceId, log: data.toString() })
      })
      process.stderr.on('data', (data) => {
        console.error('日志错误:', data.toString())
      })
      process.on('close', () => {
        resolve(logs)
      })
      // 返回进程对象以便外部控制
      resolve(process)
    })
  }

  async forwardPort(
    deviceId: string,
    devicePort: number,
    localPort: number
  ): Promise<Error | ChildProcessWithoutNullStreams> {
    return new Promise((resolve, reject) => {
      const process = spawn(`${this.libimobiledevicePath}/iproxy`, [
        localPort.toString(),
        devicePort.toString(),
        deviceId
      ])
      process.on('spawn', () => {
        console.log(`端口转发已启动: ${localPort} -> ${devicePort}`)
        resolve(process)
      })
      process.on('error', (error) => {
        reject(error)
      })
      process.stderr.on('data', (data) => {
        console.error('端口转发错误:', data.toString())
      })
    })
  }

  async backupDevice(deviceId: string, backupPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `${this.libimobiledevicePath}/idevicebackup2 -u ${deviceId} backup "${backupPath}"`
      const process = spawn('sh', ['-c', cmd], { stdio: 'pipe' })
      process.on('close', (code) => {
        if (code === 0) {
          resolve(backupPath)
        } else {
          reject(new Error('备份失败'))
        }
      })
      process.stdout.on('data', (data) => {
        this.emit('backupProgress', { deviceId, progress: data.toString() })
      })
    })
  }

  async restoreDevice(deviceId: string, backupPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = `${this.libimobiledevicePath}/idevicebackup2 -u ${deviceId} restore "${backupPath}"`
      const process = spawn('sh', ['-c', cmd], { stdio: 'pipe' })
      process.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error('恢复失败'))
        }
      })
      process.stdout.on('data', (data) => {
        this.emit('restoreProgress', { deviceId, progress: data.toString() })
      })
    })
  }

  getConnectedDeviceList(): DeviceInfo[] {
    return Array.from(this.devices.values())
  }

  // 获取设备当前状态
  getDeviceStatus(deviceId: string): number | undefined {
    return this.devices.get(deviceId)?.status
  }

  // 手动刷新设备状态
  async refreshDeviceStatus(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId)
    if (device) {
      const paired = await this.isDevicePaired(deviceId)
      const newStatus = paired ? 5 : 3
      if (device.status !== newStatus) {
        await this.updateDeviceStatus(deviceId, newStatus)
      }
    }
  }

  async rebootDevice(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(`idevicediagnostics -u ${deviceId} restart`, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  async shutdownDevice(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(`idevicediagnostics -u ${deviceId} shutdown`, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  stop(): void {
    this.isMonitoring = false
    this.devices.clear()
    this.deviceStatusMap.clear()
    this.waitTrustMap.clear()
  }
}

export default WinDeviceManager
