import { type Context } from 'hono'
import { generateHash } from './_crypto.js'

/**
 * Verify the authenticity of the request.
 *
 * @see https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#L1079
 * @see https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#L1061
 * @see https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#L1027
 */
export const validRequestFromCloudinary = async (ctx: Context) => {
  const x_cld_signature = ctx.req.header('X-Cld-Signature')
  if (!x_cld_signature) {
    return { error: new Error('X-Cld-Signature header not set') }
  }

  const x_cld_timestamp = ctx.req.header('X-Cld-Timestamp')
  if (!x_cld_timestamp) {
    return { error: new Error('X-Cld-Timestamp header not set') }
  }

  const api_secret = ctx.env.CLOUDINARY_WEBHOOK_SECRET as string | undefined
  if (!api_secret) {
    return {
      error: new Error('environment variable CLOUDINARY_WEBHOOK_SECRET not set')
    }
  }

  let req_body_str
  try {
    req_body_str = await ctx.req.text()
  } catch (err: any) {
    return {
      error: new Error(`could not read request body as string: ${err.message}`)
    }
  }

  const payload = `${req_body_str}${x_cld_timestamp}${api_secret}`
  // by default, Cloudinary hashes this payload using SHA-1
  // https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/consts.js#L135
  const algorithm = 'SHA-1'

  let payload_hash: string
  try {
    payload_hash = await generateHash({ str: payload, algorithm })
  } catch (err: any) {
    return {
      error: new Error(`could not generate ${algorithm} hash: ${err.message}`)
    }
  }

  const ts_sent = parseInt(x_cld_timestamp, 10)
  const valid_for = 7200 // 2 hours

  const req_body = JSON.parse(req_body_str)

  const ts_now = Math.round(Date.now() / 1000)
  const age = ts_now - ts_sent

  const info = {
    'Age (s)': age,
    'Valid for (s)': valid_for,
    [`payload (${algorithm})`]: payload_hash,
    'X-Cld-Signature': x_cld_signature,
    'X-Cld-Timestamp': x_cld_timestamp
  }

  if (ts_sent < ts_now - valid_for) {
    return { value: { info, req_body, valid: false } }
  }

  return { value: { info, req_body, valid: payload_hash === x_cld_signature } }
}
