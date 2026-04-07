import { useInterval } from 'vue-hooks-plus'
import { Utils } from '../utils'
import { Ref, ref, watch } from 'vue'

export const useRelativeTime = (time?: Ref<number | undefined>) => {
  const relativeTime = ref(Utils.formatRelativePastZh(time.value))

  useInterval(() => {
    relativeTime.value = Utils.formatRelativePastZh(time.value)
  }, 60_000)

  watch(time, () => {
    relativeTime.value = Utils.formatRelativePastZh(time.value)
  })

  return {
    relativeTime,
  }
}
