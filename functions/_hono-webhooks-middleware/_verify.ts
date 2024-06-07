import type { Context, Env, Input } from 'hono'
import { ZodObject, ZodRawShape } from 'zod'
import { fromZodError } from 'zod-validation-error'
import { hexStringToArrayBuffer, hmacKey } from './_crypto.js'

export const defaultOrOptional = <T>(default_value: T, optional_value?: T) => {
  if (optional_value !== undefined && optional_value !== null) {
    return optional_value!
  } else {
    return default_value
  }
}

export interface VerifyWebhookConfig<S extends ZodRawShape = {}> {
  header: string
  schema: ZodObject<S>
  secret: string
}

export interface AuditEntry {
  cf_ray: string
  message: string
  timestamp: number
}

export const makeVerifyWebhook = <
  S extends ZodRawShape = {},
  E extends Env = Env,
  P extends string = any,
  I extends Input = {}
>(
  config: VerifyWebhookConfig<S>
) => {
  const { header, schema, secret } = config

  // we declare the HMAC key here, to avoid recreating it on every request
  let key: CryptoKey
  const decoder = new TextDecoder('utf-8')

  return async function verifyWebhook(ctx: Context<E, P, I>) {
    const audit_entries: AuditEntry[] = []

    const cf_ray = ctx.req.header('CF-Ray')
    if (!cf_ray) {
      const message = 'request lacks required HTTP header CF-Ray'

      audit_entries.push({
        cf_ray: 'not-set',
        message,
        timestamp: new Date().getTime()
      })

      return {
        audit_entries,
        error: new Error(message),
        is_server: true
      }
    }

    if (!ctx.env) {
      const message =
        'request has no environment variables available in its context'

      audit_entries.push({
        cf_ray,
        message,
        timestamp: new Date().getTime()
      })

      return {
        audit_entries,
        error: new Error(message),
        is_server: true
      }
    }

    const hex_signature = ctx.req.header(config.header)
    if (!hex_signature) {
      const message = `request lacks required HTTP header ${header}`

      audit_entries.push({ cf_ray, message, timestamp: new Date().getTime() })

      return {
        audit_entries,
        error: new Error(message)
      }
    }

    audit_entries.push({
      cf_ray,
      message: `found HTTP header ${header}`,
      timestamp: new Date().getTime()
    })

    let payload: ArrayBuffer
    try {
      // TODO: this MUST be configurable, because the payload to verify varies
      // across 3rd party services. A few examples:
      // Cloudinary's payload is body+timestamp+secret
      // https://cloudinary.com/documentation/notifications#verifying_notification_signatures
      // Stripe's payload seems even more complex
      // https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts
      payload = await ctx.req.arrayBuffer()
    } catch (err: any) {
      const message = `could not read raw request body`
      audit_entries.push({ cf_ray, message, timestamp: new Date().getTime() })

      return {
        audit_entries,
        error: new Error(message)
      }
    }

    if (!key) {
      try {
        key = await hmacKey(secret)
      } catch (err: any) {
        const message = `could not generate HMAC key`
        audit_entries.push({ cf_ray, message, timestamp: new Date().getTime() })

        return {
          audit_entries,
          error: new Error(message),
          is_server: true
        }
      }

      const message = `created HMAC key using provided secret`
      audit_entries.push({ cf_ray, message, timestamp: new Date().getTime() })
    }

    const x_real_ip = ctx.req.header('x-real-ip')

    let signature: ArrayBuffer
    if (x_real_ip === '127.0.0.1') {
      // If the POST request originated from localhost (e.g. curl making a POST
      // request to a ngrok forwarding URL), we discard the given signature and
      // compute it here instead. This way we ALWAYS verify the request body.
      signature = await crypto.subtle.sign('HMAC', key, payload)
      const message = `signed payload using HMAC key because X-Real-IP is '127.0.0.1'`
      audit_entries.push({ cf_ray, message, timestamp: new Date().getTime() })
    } else {
      signature = hexStringToArrayBuffer(hex_signature)
    }

    const verified = await crypto.subtle.verify('HMAC', key, signature, payload)

    if (!verified) {
      const message = `request payload does not match signature found in ${header} header`
      audit_entries.push({ cf_ray, message, timestamp: new Date().getTime() })

      return {
        audit_entries,
        error: new Error(message)
      }
    }

    audit_entries.push({
      cf_ray,
      message: `verified that request payload matches signature found in ${header} header`,
      timestamp: new Date().getTime()
    })

    const result = schema.safeParse(JSON.parse(decoder.decode(payload)))

    if (!result.success) {
      const error = fromZodError(result.error)
      const message = `request payload does not conform to the schema: ${error.message}`

      audit_entries.push({
        cf_ray,
        message,
        timestamp: new Date().getTime()
      })

      return {
        audit_entries,
        error
      }
    }

    const req_body = result.data

    audit_entries.push({
      cf_ray,
      message: `validated request payload against schema`,
      timestamp: new Date().getTime()
    })

    ctx.req.addValidatedData('json', req_body)
    audit_entries.push({
      cf_ray,
      message: `added validated 'json' data in request context`,
      timestamp: new Date().getTime()
    })

    return { audit_entries }
  }
}
