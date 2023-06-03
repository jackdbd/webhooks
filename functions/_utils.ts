// https://emojipedia.org/
export enum Emoji {
  ArrowUp = '⬆️',
  ChartDecreasing = '📉',
  Coffin = '⚰️',
  Coin = '🪙',
  CreditCard = '💳',
  Customer = '👤',
  DollarBanknote = '💵',
  Error = '🚨',
  Failure = '❌',
  Headstone = '🪦',
  Hook = '🪝',
  Inspect = '🔍',
  Invalid = '❌',
  MoneyBag = '💰',
  Notification = '💬',
  Package = '📦',
  ShoppingBags = '🛍️',
  Ok = '✅',
  Sparkles = '✨',
  SpeakingHead = '🗣️',
  Success = '✅',
  Timer = '⏱️',
  Toolbox = '🧰',
  User = '👤',
  Valid = '✅',
  Warning = '⚠️'
}

export const badRequest = (details?: string) => {
  const message = details ? `Bad Request: ${details}` : `Bad Request`

  return new Response(JSON.stringify({ message }, null, 2), {
    status: 400,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}

export const internalServerError = (details?: string) => {
  const message = details
    ? `Internal Server Error: ${details}`
    : `Internal Server Error`

  return new Response(JSON.stringify({ message }, null, 2), {
    status: 500,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}

/**
 * Use a webhook secret key to create an HMAC.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
 */
export const hmacKey = async (secret: string) => {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const extractable = false
  const keyUsages = ['sign', 'verify'] as KeyUsage[]

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    extractable,
    keyUsages
  )

  return key
}

export const hexStringToArrayBuffer = (hex: string) => {
  const match_arr = hex.match(/../g)
  if (match_arr) {
    return new Uint8Array(match_arr.map((h) => parseInt(h, 16))).buffer
  } else {
    return new Uint8Array([]).buffer
  }
}

export const defaultOrOptional = <T>(default_value: T, optional_value?: T) => {
  if (optional_value !== undefined) {
    return optional_value!
  } else {
    return default_value
  }
}
