export const hexStringToArrayBuffer = (hex: string) => {
  const match_arr = hex.match(/../g)
  if (match_arr) {
    return new Uint8Array(match_arr.map((h) => parseInt(h, 16))).buffer
  } else {
    return new Uint8Array([]).buffer
  }
}

/**
 * Use a secret to create an HMAC.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
 */
export const hmacKey = async (secret: string, hash = 'SHA-256') => {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const extractable = false
  const keyUsages = ['sign', 'verify'] as KeyUsage[]

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash },
    extractable,
    keyUsages
  )
}
