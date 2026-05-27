import frida from 'frida'
import { createLoginPacket } from '../login/tcp-login'

const createFridaScriptTemplate = (username: string, password: string) => {
  const loginPacket = createLoginPacket(username, password)

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

          // hio_write(hio_t* io, buf, len)
          const addrWrite = hvDll.base.add(0xBB30);

          // 将 loginPacket 转换为字节数组供 Frida 使用
          const customPacket = [${loginPacket.join(', ')}];
          const customLen = customPacket.length;
          const pCustomBuf = Memory.alloc(customLen);
          pCustomBuf.writeByteArray(customPacket);
  

          // --- Hook hio_write ---
          const listener = Interceptor.attach(addrWrite, {
            onEnter(args) {
              const buf = args[1];
              const originalLen = args[2].toUInt32();

              // 登录包即使账号密码只有1位，加上外层包裹总长度也至少有 38 字节
              // 这里设为 22 字节是为了安全读取前 21 位的检测特征
              if (originalLen < 22) return;

              // 读取前 22 个字节用于特征复合匹配
              const header = buf.readByteArray(22);
              const view = new Uint8Array(header);

              // 1️⃣ 过滤网一：验证外层 TCP 协议固定魔数是否为 70 00 1a 42
              const hasOuterMagic = (view[4] === 0x70 && view[5] === 0x00 && view[6] === 0x1A && view[7] === 0x42);

              // 2️⃣ 过滤网二：验证内层 Base64 头部是否为 "/wEA" (对应解密后的 ff 01 00)
              const hasBase64Header = (view[9] === 0x2F && view[10] === 0x77 && view[11] === 0x45 && view[12] === 0x41);

              // 3️⃣ 过滤网三：验证内层登录指令码特征位是否为 "AAAF" (对应解密后的 00 00 05)
              const hasLoginOpcode = (view[17] === 0x41 && view[18] === 0x41 && view[19] === 0x41 && view[20] === 0x46);

              if (hasOuterMagic && hasBase64Header && hasLoginOpcode) {
                console.log("🎯 发现目标登录包，正在执行完全替换...");

                // 修改第二个参数 (void* buf) 指向你新申请的内存指针
                args[1] = pCustomBuf;
                
                // 修改第三个参数 (size_t len) 为新包的实际动态长度
                args[2] = ptr(customLen);

                console.log("🚀 正在卸载 Frida 拦截器...");

                listener.detach();
                send({ type: 'finish' });
              }
            }
          });

          console.log("✅ Hook 添加成功。");
        }

      
      } catch(error)  {
        console.error("❌ frida 注入代码报错")
        console.log(error)
      }
  `
}

export async function hookDll({
  pid,
  username,
  password,
}: {
  pid: number
  username: string
  password: string
}) {
  try {
    const session = await frida.attach(pid)
    session.detached.connect(() => {
      console.log('✅ Frida 已从目标进程卸载')
    })

    const script = await session.createScript(createFridaScriptTemplate(username, password))

    script.message.connect((message) => {
      if (message.type === 'send' && message.payload.type === 'finish') {
        session.detach()
      } else if (message.type === 'error') {
        console.error('❌ 脚本运行错误:', message.description)
      }
    })

    await script.load()
  } catch (e) {
    console.error(`❌ frida 注入失败`)
    console.log(e)
  }
}
