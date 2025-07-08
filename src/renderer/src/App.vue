<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
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
const activeTab = ref('overview')
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
const selectedDeviceInfo = computed(() => {
  if (!selectedDevice.value) return null
  return {
    id: selectedDevice.value.id,
    name: selectedDevice.value.info.DeviceName || 'Unknown Device',
    model: selectedDevice.value.info.ProductType || 'Unknown Model',
    version: selectedDevice.value.info.ProductVersion || 'Unknown Version',
    buildVersion: selectedDevice.value.info.BuildVersion || 'Unknown Build',
    serialNumber: selectedDevice.value.info.SerialNumber || 'Unknown Serial',
    batteryLevel: selectedDevice.value.batteryLevel || 0,
    isCharging: selectedDevice.value.isCharging || false
  }
})

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
        const info = await window.iOSDeviceAPI.getDeviceInfo(device.id)

        device.info = { ...device.info, ...info }
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

const selectDevice = (device: Device): void => {
  selectedDevice.value = device
  activeTab.value = 'overview'
}

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
  devices.value.push(device)
  addNotification('success', `设备 ${device.info.DeviceName || device.id} 已连接`)
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
  <div class="ios-device-manager">
    <!-- 顶部导航 -->
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <img src="./assets/ios-logo.svg" alt="iOS" class="logo-img" />
          <h1>iOS Device Manager</h1>
        </div>
        <div class="header-actions">
          <button :disabled="isLoading" class="btn btn-primary" @click="refreshDevices">
            <span class="icon">🔄</span>
            {{ isLoading ? '刷新中...' : '刷新设备' }}
          </button>
          <div class="device-count">
            <span class="count">{{ connectedDevicesCount }}</span>
            <span class="label">设备已连接</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 通知栏 -->
    <div v-if="notifications.length > 0" class="notifications">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', `notification-${notification.type}`]"
      >
        <span class="notification-message">{{ notification.message }}</span>
        <button class="notification-close" @click="removeNotification(notification.id)">×</button>
      </div>
    </div>

    <div class="main-content">
      <!-- 设备列表侧边栏 -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>连接的设备</h2>
        </div>
        <div class="device-list">
          <div v-if="devices.length === 0" class="empty-state">
            <div class="empty-icon">📱</div>
            <p>未发现设备</p>
            <p class="empty-hint">请连接 iOS 设备并信任此计算机</p>
          </div>
          <DeviceCard
            v-for="device in devices"
            :key="device.id"
            :device="device"
            :selected="selectedDevice?.id === device.id"
            @select="selectDevice"
          />
        </div>
      </aside>

      <!-- 主内容区域 -->
      <main class="content">
        <div v-if="!selectedDevice" class="welcome-state">
          <div class="welcome-icon">🎯</div>
          <h2>选择一个设备开始</h2>
          <p>从左侧列表中选择一个设备来查看详细信息和执行操作</p>
        </div>

        <div v-else class="device-details">
          <!-- 设备信息头部 -->
          <div class="device-header">
            <div class="device-info">
              <h2>{{ selectedDeviceInfo?.name }}</h2>
              <div class="device-meta">
                <span class="meta-item">{{ selectedDeviceInfo?.model }}</span>
                <span class="meta-item">iOS {{ selectedDeviceInfo?.version }}</span>
                <span class="meta-item">{{ selectedDeviceInfo?.serialNumber }}</span>
              </div>
            </div>
            <div class="device-status">
              <div class="battery-indicator">
                <div
                  class="battery-level"
                  :style="{ width: `${selectedDeviceInfo?.batteryLevel}%` }"
                ></div>
                <span class="battery-text">{{ selectedDeviceInfo?.batteryLevel }}%</span>
                <span v-if="selectedDeviceInfo?.isCharging" class="charging-icon">⚡</span>
              </div>
            </div>
          </div>

          <!-- 标签页导航 -->
          <nav class="tab-nav">
            <button
              v-for="tab in ['overview', 'apps', 'controls', 'logs', 'backup']"
              :key="tab"
              :class="['tab-btn', { active: activeTab === tab }]"
              @click="activeTab = tab"
            >
              {{
                {
                  overview: '概览',
                  apps: '应用管理',
                  controls: '设备控制',
                  logs: '日志',
                  backup: '备份'
                }[tab]
              }}
            </button>
          </nav>

          <!-- 标签页内容 -->
          <div class="tab-content">
            <!-- 概览标签 -->
            <div v-if="activeTab === 'overview'" class="tab-panel">
              <div class="overview-grid">
                <div class="info-card">
                  <h3>设备信息</h3>
                  <div class="info-list">
                    <div class="info-item">
                      <span class="label">设备名称:</span>
                      <span class="value">{{ selectedDeviceInfo?.name }}</span>
                    </div>
                    <div class="info-item">
                      <span class="label">型号:</span>
                      <span class="value">{{ selectedDeviceInfo?.model }}</span>
                    </div>
                    <div class="info-item">
                      <span class="label">系统版本:</span>
                      <span class="value">iOS {{ selectedDeviceInfo?.version }}</span>
                    </div>
                    <div class="info-item">
                      <span class="label">构建版本:</span>
                      <span class="value">{{ selectedDeviceInfo?.buildVersion }}</span>
                    </div>
                    <div class="info-item">
                      <span class="label">序列号:</span>
                      <span class="value">{{ selectedDeviceInfo?.serialNumber }}</span>
                    </div>
                  </div>
                </div>

                <div class="quick-actions">
                  <h3>快速操作</h3>
                  <div class="action-grid">
                    <button class="action-btn" @click="activeTab = 'apps'">
                      <span class="action-icon">📱</span>
                      <span class="action-text">应用管理</span>
                    </button>
                    <button class="action-btn" @click="activeTab = 'controls'">
                      <span class="action-icon">🎛️</span>
                      <span class="action-text">设备控制</span>
                    </button>
                    <button class="action-btn" @click="activeTab = 'logs'">
                      <span class="action-icon">📋</span>
                      <span class="action-text">查看日志</span>
                    </button>
                    <button class="action-btn" @click="activeTab = 'backup'">
                      <span class="action-icon">💾</span>
                      <span class="action-text">备份管理</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 应用管理标签 -->
            <div v-if="activeTab === 'apps'" class="tab-panel">
              <AppManager :device="selectedDevice" @notification="addNotification" />
            </div>

            <!-- 设备控制标签 -->
            <div v-if="activeTab === 'controls'" class="tab-panel">
              <DeviceControls :device="selectedDevice" @notification="addNotification" />
            </div>

            <!-- 日志标签 -->
            <div v-if="activeTab === 'logs'" class="tab-panel">
              <LogViewer :device="selectedDevice" :logs="logs" @notification="addNotification" />
            </div>

            <!-- 备份标签 -->
            <div v-if="activeTab === 'backup'" class="tab-panel">
              <BackupManager :device="selectedDevice" @notification="addNotification" />
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.ios-device-manager {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logo-img {
  width: 2rem;
  height: 2rem;
}

.logo h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: #007aff;
  color: white;
}

.btn-primary:hover {
  background: #0056cc;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.device-count {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  background: rgba(0, 122, 255, 0.1);
  border-radius: 0.5rem;
  border: 1px solid rgba(0, 122, 255, 0.2);
}

.count {
  font-size: 1.5rem;
  font-weight: 600;
  color: #007aff;
}

.label {
  font-size: 0.75rem;
  color: #666;
}

.notifications {
  position: fixed;
  top: 5rem;
  right: 1rem;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 400px;
}

.notification {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideIn 0.3s ease;
}

.notification-success {
  background: rgba(52, 199, 89, 0.9);
  color: white;
}

.notification-error {
  background: rgba(255, 59, 48, 0.9);
  color: white;
}

.notification-warning {
  background: rgba(255, 149, 0, 0.9);
  color: white;
}

.notification-info {
  background: rgba(0, 122, 255, 0.9);
  color: white;
}

.notification-close {
  background: none;
  border: none;
  color: currentColor;
  cursor: pointer;
  font-size: 1.2rem;
  padding: 0;
  margin-left: 0.5rem;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 2rem;
  padding: 2rem;
  min-height: calc(100vh - 5rem);
}

.sidebar {
  width: 300px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 1.5rem;
  height: fit-content;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.sidebar-header h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
  color: #333;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 2rem 0;
  color: #666;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.875rem;
  color: #999;
}

.content {
  flex: 1;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.welcome-state {
  text-align: center;
  padding: 4rem 0;
  color: #666;
}

.welcome-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.device-info h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: #333;
}

.device-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.meta-item {
  padding: 0.25rem 0.5rem;
  background: #f0f0f0;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  color: #666;
}

.battery-indicator {
  position: relative;
  width: 80px;
  height: 30px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.battery-level {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #34c759 0%, #30d158 100%);
  transition: width 0.3s;
}

.battery-text {
  position: relative;
  z-index: 1;
  font-size: 0.75rem;
  font-weight: 600;
  color: #333;
}

.charging-icon {
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 0.75rem;
  color: #ff9500;
}

.tab-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 0.5rem 0.5rem 0 0;
  transition: all 0.2s;
  color: #666;
  font-weight: 500;
}

.tab-btn.active {
  background: #007aff;
  color: white;
}

.tab-btn:hover {
  background: rgba(0, 122, 255, 0.1);
}

.tab-btn.active:hover {
  background: #0056cc;
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.info-card {
  background: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: 1px solid #eee;
}

.info-card h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.125rem;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item .label {
  font-weight: 500;
  color: #666;
}

.info-item .value {
  font-weight: 600;
  color: #333;
}

.quick-actions {
  background: #f8f9fa;
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: 1px solid #eee;
}

.quick-actions h3 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.125rem;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f0f0f0;
  border-color: #007aff;
}

.action-icon {
  font-size: 1.5rem;
}

.action-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #333;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
    padding: 1rem;
  }

  .sidebar {
    width: 100%;
  }

  .header-content {
    flex-direction: column;
    gap: 1rem;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
