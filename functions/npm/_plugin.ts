import { fromZodError } from 'zod-validation-error'
import {
  badRequest,
  defaultOrOptional,
  Emoji,
  hexStringToArrayBuffer,
  hmacKey
} from '../_utils.js'
import { post_request_body } from './_schemas.js'
import type { NpmWebhookEvent } from './_schemas.js'

const PREFIX = `[${Emoji.Hook} npmjs.com webhooks plugin]`

const REQUEST_HEADER_KEY = 'x-npm-signature'

/**
 * Environment variables used by this plugin.
 */
export interface PluginEnv {
  NPM_WEBHOOK_SECRET?: string
}

/**
 * Data that this plugin will add to each `fetch` request.
 */
export interface Data {
  npmValidatedWebhookEvent: NpmWebhookEvent
}

/**
 * Configuration object for this plugin.
 */
export interface PluginArgs {
  secret?: string
  shouldValidate?: boolean
}

export type PluginData = { npmValidatedWebhookEvent: NpmWebhookEvent }

const defaults = {
  secret: undefined,
  shouldValidate: true
}

export type PluginFunction<
  Env extends PluginEnv = PluginEnv,
  Params extends string = any,
  Data extends Record<string, unknown> = Record<string, unknown>
> = PagesPluginFunction<Env, Params, Data & PluginData, PluginArgs>

export default <E extends PluginEnv = PluginEnv>(pluginArgs?: PluginArgs) => {
  const options = pluginArgs || {}

  let secret = defaultOrOptional(defaults.secret, options.secret)
  const shouldValidate = defaultOrOptional(
    defaults.shouldValidate,
    options.shouldValidate
  )

  console.log({
    message: `${PREFIX} configuration`,
    secret,
    shouldValidate
  })

  // we declare the HMAC key here, to avoid recreating it on every request
  let key: CryptoKey
  const decoder = new TextDecoder('utf-8')

  return async function pluginInner(
    ctx: EventContext<E, any, Record<string, NpmWebhookEvent>>
  ) {
    const audit_trail: string[] = []

    if (secret) {
      audit_trail.push(`secret set from pluginArgs: ${secret}`)
    }

    if (ctx.env.NPM_WEBHOOK_SECRET) {
      if (secret) {
        audit_trail.push(
          `secret overridden by environment variable NPM_WEBHOOK_SECRET: ${ctx.env.NPM_WEBHOOK_SECRET}`
        )
      } else {
        audit_trail.push(
          `secret set using environment variable NPM_WEBHOOK_SECRET: ${ctx.env.NPM_WEBHOOK_SECRET}`
        )
      }
      secret = ctx.env.NPM_WEBHOOK_SECRET
    }

    if (!secret) {
      throw new Error(
        `${PREFIX} secret not set. Set a signing secret for your npmjs.com webhooks either passing it when you instantiate this plugin, or using the environment variable NPM_WEBHOOK_SECRET`
      )
    }

    if (!key) {
      key = await hmacKey(secret)
      audit_trail.push(`created HMAC key using secret: ${secret}`)
    }

    // npmjs.com uses a hex string as the signature.
    const signature_as_hex = ctx.request.headers.get(REQUEST_HEADER_KEY)
    if (!signature_as_hex) {
      return badRequest('missing webhook signature')
    }
    audit_trail.push(`found request header ${REQUEST_HEADER_KEY}`)

    const req_payload = await ctx.request.arrayBuffer()

    const x_real_ip = ctx.request.headers.get('x-real-ip')

    let signature: ArrayBuffer
    if (x_real_ip === '127.0.0.1') {
      // If the POST request originated from localhost (e.g. curl making a POST
      // request to a ngrok forwarding URL), we discard the given signature and
      // compute it here instead. This way we ALWAYS verify the request body.
      signature = await crypto.subtle.sign('HMAC', key, req_payload)
    } else {
      signature = hexStringToArrayBuffer(signature_as_hex)
    }

    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      req_payload
    )

    if (!verified) {
      audit_trail.push(
        `failed HMAC signature verification of request payload and request header ${REQUEST_HEADER_KEY}`
      )
      console.log({ message: `${PREFIX} request audit trail`, audit_trail })
      return badRequest('invalid webhook event (signature mismatch)')
    }
    audit_trail.push(`verified ${REQUEST_HEADER_KEY} using HMAC key`)

    const req_body: NpmWebhookEvent = JSON.parse(decoder.decode(req_payload))

    if (shouldValidate) {
      const result = post_request_body.safeParse(req_body)

      if (!result.success) {
        const err = fromZodError(result.error)
        console.log({
          message: `${PREFIX} ${err.message}`,
          errors: JSON.stringify(result.error.errors, null, 2),
          issues: result.error.issues
        })
        return badRequest('invalid webhook event (invalid schema)')
      }
      audit_trail.push(`validated schema of request body`)
    } else {
      audit_trail.push(`skipped request body validation`)
    }

    // make the validated webhook event available to downstream middlewares and
    // request handlers
    ctx.data.npmValidatedWebhookEvent = req_body
    audit_trail.push(`request body stored in ctx.data.npmValidatedWebhookEvent`)

    console.log({ message: `${PREFIX} request audit trail`, audit_trail })

    return ctx.next()
  }
}
