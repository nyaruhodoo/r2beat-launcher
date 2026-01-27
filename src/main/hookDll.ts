import frida, { Script, Session } from 'frida'

let currentSession: Session | null = null
let currentScript: Script | null = null

const createFridaScriptTemplate = () => {
  return /*js*/ `
      try {
        const moduleName = "hv.dll";
        const hvDll = Process.findModuleByName(moduleName);


        if(hvDll) {
          console.log("✅ 匹配到的模块：");
          console.log("   模块名：", hvDll.name);
          console.log("   基地址：", hvDll.base);
          console.log("   模块路径：", hvDll.path);
          console.log("   模块大小：", hvDll.size);

          // hio_connect(hio_t* io)
          const addrConnect = hvDll.base.add(0xB6D0);
          // hio_write(hio_t* io, buf, len)
          const addrWrite = hvDll.base.add(0xBB30);
          
          // --- Hook hio_connect ---
          Interceptor.attach(addrConnect, {
            onEnter(args) {
              const io = args[0]; 
              // 偏移 68 (17*4) 是 peeraddr 的指针 (sockaddr*)
              const pPeerAddr = io.add(68).readPointer();
              
              if (!pPeerAddr.isNull()) {
                  // 1. 解析当前 IP (sockaddr_in 结构：family(2), port(2), addr(4))
                  const family = pPeerAddr.readU16();
                  if (family === 2) { // 仅处理 IPv4
                      const ipBytes = pPeerAddr.add(4).readByteArray(4);
                      const uint8Array = new Uint8Array(ipBytes);
                      const currentIp = uint8Array[0] + "." + uint8Array[1] + "." + uint8Array[2] + "." + uint8Array[3];
                      const port = (pPeerAddr.add(2).readU8() << 8) | pPeerAddr.add(3).readU8();
                      
                      const fullAddr = currentIp + ":" + port;

                      // 2. 判断并覆盖
                      if (fullAddr === "203.107.63.136:28004") {
                          console.log("⚠️ 检测到目标地址，正在进行重定向...");
                          console.log("原地址: " + fullAddr);

                          // 写入新 IP: 114.117.135.111
                          // 114 -> 0x72, 117 -> 0x75, 135 -> 0x87, 111 -> 0x6F
                          pPeerAddr.add(4).writeByteArray([114, 117, 135, 111]);
                          
                          console.log("✅ 已重定向至: 114.117.135.111:" + port);
                      }
                  }
              }
            }
          });

          // --- Hook hio_write ---
          Interceptor.attach(addrWrite, {
            onEnter(args) {
              const buf = args[1];
              const originalLen = args[2].toUInt32();

              // 1. 快速检查开头 FF 01
              if (originalLen < 8) return;
              const firstTwo = buf.readByteArray(2);
              const view = new Uint8Array(firstTwo);

              if (view[0] === 0xFF && view[1] === 0x01) {
                console.log("🎯 发现 FF 01，开始原地覆盖...");

                // 直接修改内存：将偏移 8 的位置改为 0x05
                buf.add(8).writeU8(0x05);
                
                // 打印日志以便调试
                console.log("✅ Hook hio_write: Modified offset 8 to 0x05");

                console.log("✅ Hook 已完成，通知主进程断开连接...");
                send({ type: 'ready_to_detach' });
              }
            }
          });

          console.log("✅ Hook 添加成功。");
        }

      
      } catch(error)  {
        console.error("[Main] frida 注入代码报错")
        console.log(error)
      }
  `
}

export async function hookDll(pid: number) {
  try {
    const session = await frida.attach(pid)
    const script = await session.createScript(createFridaScriptTemplate())
    await script.load()

    currentSession = session
    currentScript = script

    script.message.connect((message) => {
      if (message.type === 'send' && message.payload.type === 'ready_to_detach') {
        cleanupFrida().then(() => {
          // 这里 detach 后，Frida 助手进程会消失，
          // 但 Hook 已经留在了游戏的内存空间里。
        })
      }
    })
  } catch (e) {
    console.error(`[Main] frida 注入失败`)
    console.log(e)
  }
}

export async function cleanupFrida() {
  try {
    if (currentScript) await currentScript.unload().catch(() => {})
    if (currentSession) await currentSession.detach().catch(() => {})
  } finally {
    currentScript = null
    currentSession = null
  }
}
