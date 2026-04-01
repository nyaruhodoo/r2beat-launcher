export class Utils {
  /**
   * 合并配置对象：以默认配置为基准，用户配置覆盖默认配置
   * @param defaultValue 默认配置
   * @param currentValue 当前/用户配置
   * @returns 合并后的新对象
   */
  static mergeSettings<T extends object>(defaultValue: T, currentValue?: Partial<T>): T {
    if (!currentValue) return defaultValue

    // 1. 创建空的新对象，避免修改原数据
    const merged = { ...defaultValue }

    // 2. 遍历默认配置的所有 key
    for (const key in currentValue) {
      if (Object.hasOwn(merged, key)) {
        merged[key] = currentValue[key]!
      }
    }

    // 4. 返回全新的合并对象
    return merged
  }
}
