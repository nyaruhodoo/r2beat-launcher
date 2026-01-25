import frida from 'frida'
import { createLoginPacket } from './tcp-login'

const createFridaScriptTemplate = (loginPackage: string) => {
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
              if (originalLen < 2) return;
              const firstTwo = buf.readByteArray(2);
              const view = new Uint8Array(firstTwo);

              if (view[0] === 0xFF && view[1] === 0x01) {
                console.log("🎯 发现 FF 01，开始原地覆盖...");

                // 2. 准备新数据 (72字符 = 36字节)
                const hexStr = ${JSON.stringify(loginPackage)};
                
                // 将 hexString 转为 Uint8Array
                const newBytes = [];
                for (let i = 0; i < hexStr.length; i += 2) {
                  newBytes.push(parseInt(hexStr.substr(i, 2), 16));
                }

                // 3. 计算实际可写入的长度 (取原长度和新数据长度的最小值)
                // 这样可以绝对保证不会发生内存越界溢出
                const writeLen = Math.min(originalLen, newBytes.length);

                // 4. 执行原地覆盖
                buf.writeByteArray(newBytes.slice(0, writeLen));

                // 5. 打印结果确认
                console.log("✅ 原地覆盖完成! 目标长度: " + originalLen + " | 实际写入: " + writeLen);
                console.log(hexdump(buf, { length: writeLen, header: true, ansi: true }));
              }
            }
          });

          console.log("✅ Hook 设置完成。");
        }

      
      } catch(error)  {
        console.error("[Main] frida 注入代码报错")
        console.log(error)
      }
  `
}

export async function hookDll(
  pid: number,
  userInfo: {
    username: string
    password: string
  }
) {
  try {
    const packageStr = createLoginPacket(userInfo.username, userInfo.password).toString('hex')
    const session = await frida.attach(pid)
    const script = await session.createScript(createFridaScriptTemplate(packageStr))
    await script.load()
  } catch (e) {
    console.error(`[Main] frida 注入失败`)
    console.log(e)
  }
}
