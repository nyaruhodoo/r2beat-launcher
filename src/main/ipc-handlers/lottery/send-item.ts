import { http } from '../../http'

const API_URL = 'https://external-api.xiyouxi.com/api/gift/sendItem'

interface SendGiftItemApiResponse {
  code: number
  data?: {
    message?: string
  }
}

export async function sendGiftItemRequest(params: {
  token: string
  idx: number
  character_name: string
}): Promise<{ success: boolean; error?: string }> {
  const { token, idx, character_name } = params

  const body = new URLSearchParams({
    idx: String(idx),
    character_name,
    type: '2',
  })

  try {
    const { data } = await http.post<SendGiftItemApiResponse>(API_URL, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: token,
      },
    })

    if (data.code === 0) {
      return { success: true }
    }

    throw new Error(data.data?.message?.trim() || '赠送失败')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
