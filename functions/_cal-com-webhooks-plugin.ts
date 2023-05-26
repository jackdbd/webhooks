import { post_request_body } from './_cal-com-webhooks-schemas.js'
import type { CalWebhookEvent } from './_cal-com-webhooks-schemas.js'

// https://emojipedia.org/
export enum Emoji {
  Error = '🚨',
  Hook = '🪝',
  Invalid = '❌',
  SpeakingHead = '🗣️',
  Valid = '✅',
  Warning = '⚠️'
}

const PREFIX = `[${Emoji.SpeakingHead} cal.com webhooks plugin]`

/**
 * Environment variables used by this Cloudflare Pages Functions plugin.
 */
export interface CalComPluginEnv {
  CAL_WEBHOOK_SECRET?: string
}

/**
 * Data that this plugin will add to each fetch request.
 *
 * - If you use "vanilla" Cloudflare Pages Function, access the data at `ctx.data.verifyCalComWebhook`
 * - If you use a web framework like Hono, access the data at `ctx.env.eventContext.data.verifyCalComWebhook`
 */
export interface Data {
  calComValidatedWebhookEvent: CalWebhookEvent
}

/**
 * Configuration object for this plugin.
 */
export interface PluginArgs {
  secret?: string
}

export type PluginData = { calComValidatedWebhookEvent: CalWebhookEvent }

const defaults = {
  secret: 'my-webhook-secret'
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

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    extractable,
    keyUsages
  )

  console.log(
    `${PREFIX} HMAC SHA-256 created from signing secret ${secret} (this key can: ${keyUsages.join(
      ', '
    )})`
  )

  return cryptoKey
}

export const hexStringToArrayBuffer = (hex: string) => {
  const match_arr = hex.match(/../g)
  if (match_arr) {
    return new Uint8Array(match_arr.map((h) => parseInt(h, 16))).buffer
  } else {
    return new Uint8Array([]).buffer
  }
}

export type TelegramPagesPluginFunction<
  Env extends CalComPluginEnv = CalComPluginEnv,
  Params extends string = any,
  Data extends Record<string, unknown> = Record<string, unknown>
> = PagesPluginFunction<Env, Params, Data & PluginData, PluginArgs>

export const badRequest = (details?: string) => {
  const message = details ? `Bad Request: ${details}` : `Bad Request`

  return new Response(JSON.stringify({ message }, null, 2), {
    status: 400,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}

export const calComPlugin = <E extends CalComPluginEnv = CalComPluginEnv>(
  pluginArgs?: PluginArgs
) => {
  let secret = pluginArgs?.secret

  // we declare the HMAC key here, to avoid recreating it on every request
  let key: CryptoKey
  const decoder = new TextDecoder('utf-8')

  return async function calComPluginInner(
    ctx: EventContext<E, any, Record<string, CalWebhookEvent>>
  ) {
    if (!secret) {
      secret = ctx.env.CAL_WEBHOOK_SECRET
    }
    if (!secret) {
      throw new Error(`${PREFIX} secret not set`)
    }

    // Verify the authenticity of the received payload
    // https://cal.com/docs/core-features/webhooks#verifying-the-authenticity-of-the-received-payload

    if (!key) {
      key = await hmacKey(secret)
    }

    // cal.com uses a hex string as the signature. See here:
    // https://github.com/calcom/cal.com/blob/main/packages/features/webhooks/lib/sendPayload.ts#L153
    const signature_as_hex = ctx.request.headers.get('X-Cal-Signature-256')
    if (!signature_as_hex) {
      return badRequest('missing webhook signature')
    }

    // https://community.cloudflare.com/t/how-do-i-read-the-request-body-as-json/155393/2
    // Here we need to read the request body twice. We can either:
    // - clone the entire request using ctx.request.clone()
    // - use JSON parse on the UTF-8 decoded string
    const request_payload = await ctx.request.arrayBuffer()

    const x_real_ip = ctx.request.headers.get('x-real-ip')
    console.log(`${PREFIX} X-Real-IP: ${x_real_ip} `)

    let signature: ArrayBuffer
    if (x_real_ip === '127.0.0.1') {
      // On localhost we discard the given signature, and compute it here instead
      signature = await crypto.subtle.sign('HMAC', key, request_payload)
    } else {
      signature = hexStringToArrayBuffer(signature_as_hex)
    }

    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      request_payload
    )

    if (!verified) {
      return badRequest('invalid cal.com webhook event (signature mismatch)')
    }

    const body = JSON.parse(decoder.decode(request_payload))

    const result = post_request_body.safeParse(body)

    if (!result.success) {
      const err = result.error
      console.log({
        message: `${PREFIX} Zod validation error`,
        errors: err.errors,
        issues: err.issues
      })
      return badRequest('invalid cal.com webhook event (invalid schema)')
    }

    // make the validated webhook event available to downstream middlewares and
    // request handlers
    ctx.data.calComValidatedWebhookEvent = body as CalWebhookEvent
    console.log(
      `${PREFIX} webhook event validated and stored in ctx.data.calComValidatedWebhookEvent`
    )

    return ctx.next()
  }
}
