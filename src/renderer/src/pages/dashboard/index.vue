<script setup lang="ts">
// import DeviceCard from './components/DeviceCard.vue'
// import AppManager from './components/AppManager.vue'
// import DeviceControls from './components/DeviceControls.vue'
// import LogViewer from './components/LogViewer.vue'
// import BackupManager from './components/BackupManager.vue'

// 类型定义
interface Device {
  id: string
  info: Record<string, string>
  name?: string
  model?: string
  version?: string
  batteryLevel?: number
  isCharging?: boolean
}

interface LogData {
  deviceId: string
  timestamp: number
  level: string
  message: string
}

// 响应式数据
const devices = ref<Device[]>([])
const selectedDevice = ref<Device | null>(null)
// const activeTab = ref('overview')
const logs = ref<LogData[]>([])
const isLoading = ref(false)
const notifications = ref<
  Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    timestamp: number
  }>
>([])

// 计算属性
const connectedDevicesCount = computed(() => devices.value.length)
// const selectedDeviceInfo = computed(() => {
//   if (!selectedDevice.value) return null
//   return {
//     id: selectedDevice.value.id,
//     name: selectedDevice.value.info.DeviceName || 'Unknown Device',
//     model: selectedDevice.value.info.ProductType || 'Unknown Model',
//     version: selectedDevice.value.info.ProductVersion || 'Unknown Version',
//     buildVersion: selectedDevice.value.info.BuildVersion || 'Unknown Build',
//     serialNumber: selectedDevice.value.info.SerialNumber || 'Unknown Serial',
//     batteryLevel: selectedDevice.value.batteryLevel || 0,
//     isCharging: selectedDevice.value.isCharging || false
//   }
// })

// 方法
const refreshDevices = async (): Promise<void> => {
  isLoading.value = true
  try {
    const deviceList = await window.iOSDeviceAPI.getConnectedDevices()
    devices.value = deviceList

    // 如果当前选中的设备已断开，清除选择
    if (selectedDevice.value && !deviceList.find((d) => d.id === selectedDevice.value?.id)) {
      selectedDevice.value = null
    }

    // 获取设备详细信息
    for (const device of devices.value) {
      try {
        const deviceInfo = await window.iOSDeviceAPI.getDeviceInfo(device.id)
        device.info = {
          DeviceName: deviceInfo.DeviceName || '未知设备',
          ProductVersion: deviceInfo.ProductVersion || '未知版本',
          ModelNumber: deviceInfo.ModelNumber || '未知型号'
        }
      } catch (error) {
        console.error(`Failed to get info for device ${device.id}:`, error)
      }
    }

    addNotification('success', `发现 ${deviceList.length} 个设备`)
  } catch (error) {
    console.error('Failed to refresh devices:', error)
    addNotification('error', '刷新设备列表失败')
  } finally {
    isLoading.value = false
  }
}

// const selectDevice = (device: Device): void => {
//   selectedDevice.value = device
//   activeTab.value = 'overview'
// }

const addNotification = (type: 'success' | 'error' | 'warning' | 'info', message: string): void => {
  const notification = {
    id: Date.now().toString(),
    type,
    message,
    timestamp: Date.now()
  }
  notifications.value.push(notification)

  // 自动移除通知
  setTimeout(() => {
    removeNotification(notification.id)
  }, 5000)
}

const removeNotification = (id: string): void => {
  const index = notifications.value.findIndex((n) => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

const onDeviceConnected = (device: Device): void => {
  // 查找是否已存在相同设备
  const existingDeviceIndex = devices.value.findIndex((d) => d.id === device.id)
  if (existingDeviceIndex !== -1) {
    // 更新设备信息
    devices.value[existingDeviceIndex] = { ...device }
  } else {
    // 新设备，添加到列表
    devices.value.push(device)
  }
}

const onDeviceDisconnected = (device: Device): void => {
  const index = devices.value.findIndex((d) => d.id === device.id)
  if (index > -1) {
    devices.value.splice(index, 1)
    addNotification('warning', `设备 ${device.info.DeviceName || device.id} 已断开`)
  }

  if (selectedDevice.value?.id === device.id) {
    selectedDevice.value = null
  }
}

const onDeviceLog = (logData: any): void => {
  // 兼容 timestamp 为 string 的情况
  const normalizedLog: LogData = {
    ...logData,
    timestamp: typeof logData.timestamp === 'string' ? Number(logData.timestamp) : logData.timestamp
  }
  logs.value.push(normalizedLog)
  // 限制日志数量
  if (logs.value.length > 1000) {
    logs.value.splice(0, 100)
  }
}

// 生命周期
onMounted(() => {
  refreshDevices()

  // 设置事件监听
  window.iOSDeviceAPI.onDeviceConnected(onDeviceConnected)
  window.iOSDeviceAPI.onDeviceDisconnected(onDeviceDisconnected)
  window.iOSDeviceAPI.onDeviceLog(onDeviceLog)
})

onUnmounted(() => {
  window.iOSDeviceAPI.removeAllListeners()
})
</script>

<template>
  <div class="app-container">
    <el-button type="primary" :loading="isLoading" @click="refreshDevices">刷新设备</el-button>
    <div>
      <span>设备数：{{ connectedDevicesCount }}</span>
    </div>
    <div>
      <span>设备信息</span>
      {{ devices }}
    </div>
  </div>
</template>
