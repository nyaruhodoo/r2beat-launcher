import { markRaw, shallowRef, watch, type ShallowRef } from 'vue'

/**
 * 大数据量定制的本地存储 Hook
 * 核心：使用 shallowRef 跳过 Vue 的深度遍历
 */
export function useLocalStorageStateShallow<T extends object>(
  key: string,
  options: { defaultValue: T },
): [ShallowRef<T>, (updater: T | ((prev: T) => T)) => void] {
  // 1. 初始化读取：解析后立刻用 markRaw 锁定，防止被其他 ref 意外代理
  const readValue = (): T => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        return markRaw(JSON.parse(raw))
      }
    } catch (e) {
      console.error(`[Storage Error] ${key}:`, e)
    }
    return markRaw(options.defaultValue)
  }

  // 2. 使用 shallowRef：只有 state.value = xxx 这种赋值才会触发更新
  const state = shallowRef<T>(readValue())

  // 3. Setter 函数
  const setState = (updater: T | ((prev: T) => T)) => {
    const nextValue =
      typeof updater === 'function' ? (updater as (state: T) => T)(state.value) : updater

    // 赋值时再次 markRaw，确保引用替换
    state.value = markRaw(nextValue)
  }

  // 4. 持久化
  watch(
    state,
    (nv) => {
      localStorage.setItem(key, JSON.stringify(nv))
    },
    { deep: false, flush: 'post' },
  ) // 明确指定不进行深度监听

  // @ts-expect-error  先不管了
  return [state, setState]
}
