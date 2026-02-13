import frida from 'frida'
import { createLoginPacket } from './tcp-login'

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
          Interceptor.attach(addrWrite, {
            onEnter(args) {
              const buf = args[1];
              const originalLen = args[2].toUInt32();

              if (originalLen < 8) return;
              // 读取前两个字节判断是否为目标登陆包
              const header = buf.readByteArray(2);
              const headerView = new Uint8Array(header);

              if (headerView[0] === 0xFF && headerView[1] === 0x01) {
                console.log("🎯 发现登陆包，正在执行完全替换");

                // 修改第二个参数 (void* buf) 指向新申请的内存
                args[1] = pCustomBuf;
                // 修改第三个参数 (size_t len) 为新包的长度
                args[2] = ptr(customLen);
 
                
                console.log("✅ 修改成功");
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

export async function hookDll({
  pid,
  username,
  password
}: {
  pid: number
  username: string
  password: string
}) {
  try {
    const session = await frida.attach(pid)
    const script = await session.createScript(createFridaScriptTemplate(username, password))
    await script.load()
  } catch (e) {
    console.error(`[Main] frida 注入失败`)
    console.log(e)
  }
}
