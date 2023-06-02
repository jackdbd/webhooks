import type { Context, Env, Input } from 'hono'
import { z, ZodObject } from 'zod'
import { head, body } from '../_html.js'
import { ValidationError, fromZodError } from 'zod-validation-error'

const default_schema = z.object({})

export type DefaultWebhook = z.infer<typeof default_schema>

/**
 * https://emojipedia.org/
 */
export enum Emoji {
  Error = '🚨',
  Failure = '❌',
  Fire = '🔥',
  Hook = '🪝',
  Warning = '⚠️'
}

export const NAME = 'hono webhooks middleware'
export const PREFIX = `[${Emoji.Hook} ${NAME}]`

export const badRequest = (
  ctx: Context<Env, any, {}>,
  message: string = 'Bad Request'
) => {
  const content_type = ctx.req.headers.get('content-type')

  if (content_type === 'application/json') {
    return ctx.json({ error: true, message }, { status: 400 })
  } else {
    const instructions = `<p>${message}</p>`

    const html = `
<!DOCTYPE html>
<html lang="en">
  ${head()}
  ${body({ title: 'Bad request', instructions })}
</html>`

    return ctx.html(html)
  }
}

export const serviceUnavailable = (
  ctx: Context<Env, any, {}>,
  message: string = 'Service unavailable'
) => {
  const content_type = ctx.req.headers.get('content-type')

  if (content_type === 'application/json') {
    return ctx.json({ error: true, message }, { status: 503 })
  } else {
    const instructions = `<p>${message}</p>`

    const html = `
<!DOCTYPE html>
<html lang="en">
  ${head()}
  ${body({ title: 'Service unavailable', instructions })}
</html>`

    return ctx.html(html)
  }
}

export const defaultOrOptional = <T>(default_value: T, optional_value?: T) => {
  if (optional_value !== undefined && optional_value !== null) {
    return optional_value!
  } else {
    return default_value
  }
}

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

export interface VerifyWebhookConfig<
  T extends DefaultWebhook = DefaultWebhook
> {
  env_var: string
  header: string
  schema?: ZodObject<T>
  secret: string
}

export interface AuditEntry {
  cf_ray: string
  message: string
  timestamp: number
}

export interface Environment extends Env {
  Bindings: {
    [env_var: string]: string | undefined
    // WEBHOOK_SECRET?: string
  }
  Variables: {
    'webhook-verification-message': string
    // [webhook_verification_var: string]: string
  }
}

export type VerifyWebhook<
  E extends Environment = Environment,
  P extends string = any,
  I extends Input = {}
> = (ctx: Context<E, P, I>) => Promise<{
  audit_trail: AuditEntry[]
  error?: Error | ValidationError
  is_server?: boolean
}>

export const makeVerifyWebhook = (
  config: VerifyWebhookConfig
): VerifyWebhook => {
  const { header, schema, secret } = config
  // const { env_var, header, schema, secret } = config

  // const webhook_verification_var = 'webhook-verification-message'

  // const env = {
  //   Bindings: { [env_var]: env_var },
  //   Variables: { [webhook_verification_var]: webhook_verification_var }
  // }
  // type RuntimeEnv = Environment & typeof env

  // we declare the HMAC key here, to avoid recreating it on every request
  let key: CryptoKey
  const decoder = new TextDecoder('utf-8')

  return async function verifyWebhook(ctx) {
    const audit_trail: AuditEntry[] = []
    const hex_signature = ctx.req.headers.get(config.header)
    const cf_ray = ctx.req.headers.get('CF-Ray')
    if (!cf_ray) {
      return {
        audit_trail,
        error: new Error(`request lacks required HTTP header CF-Ray`),
        is_server: true
      }
    }

    if (!hex_signature) {
      const message = `request lacks required HTTP header ${header}`
      // This is a client error, not an application error. We log it and return
      // 400 bad request without telling anything more to the client. We do NOT
      // want to tell the client that it needs to send us the required header.
      audit_trail.push({ cf_ray, message, timestamp: new Date().getTime() })

      return { audit_trail, error: new Error(message) }
    }

    audit_trail.push({
      cf_ray,
      message: `found HTTP header ${header}`,
      timestamp: new Date().getTime()
    })

    let payload: ArrayBuffer
    try {
      payload = await ctx.req.arrayBuffer()
    } catch (err: any) {
      const message = `could not read raw request body`
      audit_trail.push({ cf_ray, message, timestamp: new Date().getTime() })

      return { audit_trail, error: new Error(message) }
    }

    if (!key) {
      try {
        key = await hmacKey(secret)
      } catch (err: any) {
        const message = `could not generate HMAC key`
        audit_trail.push({ cf_ray, message, timestamp: new Date().getTime() })

        return { audit_trail, error: new Error(message), is_server: true }
      }

      const message = `created HMAC key using provided secret`
      audit_trail.push({ cf_ray, message, timestamp: new Date().getTime() })
    }

    const x_real_ip = ctx.req.headers.get('x-real-ip')

    let signature: ArrayBuffer
    if (x_real_ip === '127.0.0.1') {
      // If the POST request originated from localhost (e.g. curl making a POST
      // request to a ngrok forwarding URL), we discard the given signature and
      // compute it here instead. This way we ALWAYS verify the request body.
      signature = await crypto.subtle.sign('HMAC', key, payload)
      const message = `signed payload using HMAC key because X-Real-IP is '127.0.0.1'`
      audit_trail.push({ cf_ray, message, timestamp: new Date().getTime() })
    } else {
      signature = hexStringToArrayBuffer(hex_signature)
    }

    const verified = await crypto.subtle.verify('HMAC', key, signature, payload)

    if (!verified) {
      const message = `payload does not match expected signature`
      audit_trail.push({ cf_ray, message, timestamp: new Date().getTime() })

      return { audit_trail, error: new Error(message) }
    }

    audit_trail.push({
      cf_ray,
      message: `payload matches expected signature`,
      timestamp: new Date().getTime()
    })

    let req_body: any
    let verification_message: string
    if (schema) {
      audit_trail.push({
        cf_ray,
        message: `validate request body against provided schema`,
        timestamp: new Date().getTime()
      })

      const result = schema.safeParse(JSON.parse(decoder.decode(payload)))

      if (!result.success) {
        const error = fromZodError(result.error)
        audit_trail.push({
          cf_ray,
          message: error.message,
          timestamp: new Date().getTime()
        })

        return { audit_trail, error }
      }

      req_body = result.data
      verification_message = `webhook signature verified and request body validated by ${NAME}`

      audit_trail.push({
        cf_ray,
        message: `request body validated against provided schema`,
        timestamp: new Date().getTime()
      })
    } else {
      req_body = JSON.parse(decoder.decode(payload))
      verification_message = `webhook signature verified by ${NAME}`
    }

    ctx.req.addValidatedData('json', req_body)
    audit_trail.push({
      cf_ray,
      message: `added validated 'json' data in request context`,
      timestamp: new Date().getTime()
    })

    // TODO: make it configurable
    ctx.set('webhook-verification-message', verification_message)
    audit_trail.push({
      cf_ray,
      message: `set 'webhook-verification-message' in request context`,
      timestamp: new Date().getTime()
    })

    return { audit_trail }
  }
}
