import { app } from 'electron'

import { is } from '@electron-toolkit/utils'
import { dirname } from 'path'

export class Utils {
  static getTargetDir() {
    if (is.dev) {
      return app.getAppPath()
    } else {
      // 生产环境：获取应用可执行文件所在目录
      return dirname(app.getPath('exe'))
    }
  }
}
