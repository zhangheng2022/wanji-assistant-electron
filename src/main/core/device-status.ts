import { exec } from 'child_process'

export interface DeviceStatus {
  deviceId: string
  accessible: 'password' | 'nopair' | 'waitpair' | 'success'
}

export class DeviceStatusManager {
  private ideviceinfoPath: string
  private watchers: Map<string, NodeJS.Timeout> = new Map()

  constructor(options?: { ideviceinfoPath?: string }) {
    // 默认使用系统 PATH 中的命令
    this.ideviceinfoPath = options?.ideviceinfoPath || 'ideviceinfo'
  }

  /**
   * 获取设备状态信息（解锁、密码、访问权限）
   */
  public getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    return new Promise((resolve) => {
      let result: DeviceStatus
      const cmd = `"${this.ideviceinfoPath}" pair -u ${deviceId}`
      exec(cmd, (_, stdout) => {
        console.log(stdout)
        const passwordMatch = stdout.includes('Please enter the passcode')
        if (passwordMatch) {
          result = {
            deviceId,
            accessible: 'password'
          }
          return resolve(result)
        }
        const waitpairMatch = stdout.includes('Please accept the trust dialog')
        if (waitpairMatch) {
          result = {
            deviceId,
            accessible: 'waitpair'
          }
          return resolve(result)
        }
        const nopairMatch = stdout.includes('said that the user denied the trust dialog')
        if (nopairMatch) {
          result = {
            deviceId,
            accessible: 'nopair'
          }
          return resolve(result)
        }
        // 如果没有匹配到任何状态，默认认为设备已成功配对并解锁
        result = {
          deviceId,
          accessible: 'success'
        }
        return resolve(result)
      })
    })
  }

  /**
   * 开始轮询监听设备状态（直到 success / nopair 或超时）
   * @param deviceId 设备序列号
   * @param onStatusChange 状态变更回调函数
   * @param timeout 最长监听时长（毫秒），默认 10000
   */
  public startWatchingDeviceStatus(
    deviceId: string,
    onStatusChange: (status: DeviceStatus) => void,
    timeout: number = 60000
  ): void {
    if (this.watchers.has(deviceId)) {
      console.warn(`设备 ${deviceId} 已在监听中`)
      return
    }
    let lastStatus: DeviceStatus['accessible'] | null = null
    const interval = 1000
    let elapsed = 0
    const timer = setInterval(async () => {
      elapsed += interval
      const status = await this.getDeviceStatus(deviceId)
      if (status.accessible !== lastStatus) {
        lastStatus = status.accessible
        onStatusChange(status)
      }
      if (status.accessible === 'success' || status.accessible === 'nopair' || elapsed >= timeout) {
        this.stopWatchingDeviceStatus(deviceId)
      }
    }, interval)

    this.watchers.set(deviceId, timer)
  }

  /**
   * 停止监听某个设备的状态
   */
  public stopWatchingDeviceStatus(deviceId: string): void {
    const timer = this.watchers.get(deviceId)
    if (timer) {
      clearInterval(timer)
      this.watchers.delete(deviceId)
    }
  }
}
