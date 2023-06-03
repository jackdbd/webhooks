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

// https://stackoverflow.com/a/11058858
export const str2ab = (str: string) => {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

export const ab2str = (ab: ArrayBuffer) => {
  return [...new Uint8Array(ab)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

export interface HashConfig {
  /**
   * http://udn.realityripple.com/docs/Web/API/SubtleCrypto/digest
   */
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

  str: string
}

export const generateHash = async ({ algorithm, str }: HashConfig) => {
  const digest = await crypto.subtle.digest(algorithm, str2ab(str))
  return ab2str(digest)
}
