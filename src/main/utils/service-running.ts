import { exec } from 'child_process'

function checkServiceRunning(serviceName: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    exec(`sc query "${serviceName}"`, (error, stdout) => {
      if (error) return reject(error)
      // 查询结果中包含 RUNNING 表示正在运行
      resolve(stdout.includes('RUNNING'))
    })
  })
}

function startService(serviceName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`net start "${serviceName}"`, (error, stdout) => {
      if (error) return reject(error)
      resolve(stdout)
    })
  })
}
/**
 * 确保指定的 Windows 服务正在运行
 * @param serviceName - 服务名称，默认为 'MobileDeviceService'
 * @returns {Promise<void>}
 */
export async function ensureServiceRunning(serviceName: string): Promise<void> {
  if (!serviceName) {
    return Promise.reject(new Error('服务名称不能为空'))
  }
  const isRunning = await checkServiceRunning(serviceName)
  if (!isRunning) {
    console.log(`[${serviceName}] 服务未运行，尝试启动...`)
    try {
      const result = await startService(serviceName)
      console.log(`[${serviceName}] 服务已启动:`, result)
    } catch (error) {
      console.error(`[${serviceName}] 启动服务失败:`, error)
      return Promise.reject(new Error(`无法启动服务 ${serviceName}`))
    }
  } else {
    console.log(`[${serviceName}] 服务已在运行`)
  }
  return Promise.resolve()
}
