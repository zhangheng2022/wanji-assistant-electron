import net from 'net'
import os from 'os'
import bplistCreator from 'bplist-creator'
// import bplistParser from 'bplist-parser'
import plist from 'plist'
// import { XMLParser } from 'fast-xml-parser'

type UsbmuxdMessage = {
  MessageType: string
  DeviceID?: number
  Properties?: {
    ConnectionType: string
    DeviceID: number
    LocationID: number
    ProductID: number
    SerialNumber: string
  }
}

export function listenToUsbmuxd(onChange: (msg: UsbmuxdMessage) => void): void {
  const isMac = os.platform() === 'darwin'
  const isWin = os.platform() === 'win32'

  const socket = isMac
    ? net.connect({ path: '/var/run/usbmuxd' }, onConnected)
    : net.connect(27015, '127.0.0.1', onConnected)

  socket.on('data', async (data: Buffer) => {
    const payload = data.subarray(16)
    const text = payload.toString('utf8')
    try {
      const parsed = plist.parse(text)
      console.log('✅ 解析成功:', parsed)
      onChange(parsed as UsbmuxdMessage)
    } catch (e) {
      console.error('❌ XML plist 解析失败:', e)
    }
  })

  socket.on('error', (err) => {
    console.error('[usbmuxd] 连接失败:', err)
    if (isWin) {
      console.error('请确认你的 usbmuxd.exe 正在运行并监听 27015 端口')
    } else if (isMac) {
      console.error('请确认 macOS 的 usbmuxd 正常运行，插入设备后才能收到事件')
    }
  })

  function onConnected(): void {
    const payload = createListenPayload()
    socket.write(payload)
  }
}

function createListenPayload(): Buffer {
  const plist = {
    MessageType: 'Listen',
    ClientVersionString: 'ElectronApp',
    ProgName: 'MyElectronApp',
    kLibUSBMuxVersion: 3
  }

  const plistBuffer = bplistCreator(plist)
  const header = Buffer.alloc(16)
  header.writeUInt32LE(16 + plistBuffer.length, 0) // 总长度
  header.writeUInt32LE(1, 4) // version
  header.writeUInt32LE(8, 8) // message type = plist
  header.writeUInt32LE(1, 12) // tag
  return Buffer.concat([header, plistBuffer])
}
