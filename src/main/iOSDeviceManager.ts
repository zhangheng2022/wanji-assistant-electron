import type { ChildProcessWithoutNullStreams } from 'child_process'
import { spawn, exec } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'

class iOSDeviceManager extends EventEmitter {
  devices: Map<string, Record<string, string>>
  isMonitoring: boolean
  libimobiledevicePath: string

  constructor() {
    super()
    this.devices = new Map()
    this.isMonitoring = false
    this.libimobiledevicePath = this.findLibimobiledevicePath()
  }

  findLibimobiledevicePath(): string {
    // 根据平台返回不同的路径
    const platform = process.platform
    console.log(platform, join(__dirname, '../../resources/libimobiledevice/win-x64'))

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
    if (this.isMonitoring) return

    this.isMonitoring = true

    // 定期检查设备连接状态
    setInterval(async () => {
      try {
        const devices = await this.getConnectedDevices()
        this.updateDeviceList(devices)
      } catch (error) {
        console.error('设备监控错误:', error)
      }
    }, 2000)

    // 初始检查
    const devices = await this.getConnectedDevices()
    this.updateDeviceList(devices)
  }

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

  async getDeviceInfo(deviceId: string): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      exec(`ideviceinfo -u ${deviceId}`, (error, stdout) => {
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

  async updateDeviceList(currentDevices: string[]): Promise<void> {
    const previousDevices = Array.from(this.devices.keys())

    // 检查新连接的设备
    for (const deviceId of currentDevices) {
      if (!this.devices.has(deviceId)) {
        try {
          const deviceInfo = await this.getDeviceInfo(deviceId)
          this.devices.set(deviceId, deviceInfo)

          console.log(`设备已连接: ${deviceInfo.DeviceName || deviceId}`)
          this.emit('deviceConnected', { id: deviceId, info: deviceInfo })
        } catch (error) {
          console.error(`获取设备信息失败 (${deviceId}):`, error)
        }
      }
    }

    // 检查断开连接的设备
    for (const deviceId of previousDevices) {
      if (!currentDevices.includes(deviceId)) {
        const deviceInfo = this.devices.get(deviceId)
        this.devices.delete(deviceId)

        console.log(`设备已断开: ${deviceInfo?.DeviceName || deviceId}`)
        this.emit('deviceDisconnected', { id: deviceId, info: deviceInfo })
      }
    }
  }

  async installApp(deviceId: string, ipaPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = `ideviceinstaller -u ${deviceId} -i "${ipaPath}"`

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
      const process = spawn('idevicesyslog', ['-u', deviceId])

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
      const process = spawn('iproxy', [localPort.toString(), devicePort.toString(), deviceId])

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
      const cmd = `idevicebackup2 -u ${deviceId} backup "${backupPath}"`

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
      const cmd = `idevicebackup2 -u ${deviceId} restore "${backupPath}"`

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

  getConnectedDeviceList(): Array<{
    id: string
    name: string
    model: string
    version: string
    info: Record<string, string>
  }> {
    return Array.from(this.devices.entries()).map(([id, info]) => ({
      id,
      name: info.DeviceName || 'Unknown Device',
      model: info.ProductType || 'Unknown Model',
      version: info.ProductVersion || 'Unknown Version',
      info
    }))
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
  }
}

export default iOSDeviceManager
