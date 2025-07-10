import net from 'net'
import bplistCreator from 'bplist-creator'
import plist from 'plist'

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
  const socket = net.connect(27015, '127.0.0.1', () => {
    const payload = createListenPayload()
    socket.write(payload)
  })
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
  socket.on('error', (err) => console.error('[usbmuxd] 连接失败:', err))
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
  header.writeUInt32LE(16 + plistBuffer.length, 0)
  header.writeUInt32LE(1, 4)
  header.writeUInt32LE(8, 8)
  header.writeUInt32LE(1, 12)
  return Buffer.concat([header, plistBuffer])
}
