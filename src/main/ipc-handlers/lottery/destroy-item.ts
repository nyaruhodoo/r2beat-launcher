import { http } from '../../http'

const API_URL = 'https://external-api.xiyouxi.com/api/gift/destroyItem'

interface DestroyGiftItemApiResponse {
  code: number
  data?: {
    message?: string
  }
}

export async function destroyGiftItemRequest(params: {
  token: string
  idx: number
}): Promise<{ success: boolean; error?: string }> {
  const { token, idx } = params

  const body = new URLSearchParams({
    idx: String(idx),
  })

  try {
    const { data } = await http.post<DestroyGiftItemApiResponse>(API_URL, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: token,
      },
    })

    if (data.code === 1) {
      return { success: true }
    }

    throw new Error(data.data?.message?.trim() || '转换失败')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
