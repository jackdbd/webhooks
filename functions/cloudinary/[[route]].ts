import { Hono, type Env, Context } from 'hono'
import { handle, type EventContext } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import {
  AppEnvironment,
  EnvVarsEnum,
  EventContextData
} from '../_environment.js'
import { notFound, onError } from '../_hono-handlers.js'
import {
  type AuditTrail,
  webhooksMiddleware
} from '../_hono-webhooks-middleware/_middleware.js'
import { body, head } from '../_html.js'
import { post_request_body, type WebhookEvent } from './_schemas.js'
import { Emoji } from '../_utils.js'
import {
  hmacKey,
  hexStringToArrayBuffer
} from '../_hono-webhooks-middleware/_crypto.js'

/**
 * Bindings available in this Hono app.
 */
type Bindings = {
  [key in EnvVarsEnum]: string | undefined
} & { eventContext: EventContext<AppEnvironment, any, EventContextData> }

enum VariablesEnum {
  WebhookDebugKey = 'cloudinary-webhook-debug-key'
}

/**
 * Variables available in this Hono app.
 */
type Variables = {
  [key in VariablesEnum]: AuditTrail
}

interface Environment extends Env {
  Bindings: Bindings
  Variables: Variables
}

const logAuditTrail = async (ctx: Context) => {
  const audit_trail = ctx.get(VariablesEnum.WebhookDebugKey) as AuditTrail

  console.log(audit_trail.summary)
  audit_trail.entries.forEach((d) => {
    console.log(d)
  })
}

const sendAuditTrailToTelegram = async (ctx: Context) => {
  const audit_trail = ctx.get(VariablesEnum.WebhookDebugKey)
  const { telegram } = ctx.env.eventContext.data

  const s = `${JSON.stringify(audit_trail.entries, null, 2)}`
  await telegram.sendMessage(
    `<b>Audit trail</b>\n\n<b>Summary</b>\n${audit_trail.summary}\n\n<b>Entries</b>\n<pre><code>${s}</code></pre>`
  )
}

const app = new Hono<Environment>().basePath('/cloudinary')
app.use('*', logger())
app.use('*', prettyJSON())
// app.use(
//   '*',
//   webhooksMiddleware({
//     debug_key: VariablesEnum.WebhookDebugKey,
//     header: 'X-Cld-Signature', // The X-Cld-Timestamp is also required to verify the signature
//     secret: EnvVarsEnum.SecretForCloudinaryWebhooks,
//     schema: post_request_body,
//     beforeClientErrorResponse: logAuditTrail,
//     beforeServerErrorResponse: sendAuditTrailToTelegram
//   })
// )

app.notFound(notFound)
app.onError(onError)

app.get('/', async (ctx) => {
  const title = `Cloudinary.com webhooks`

  const instructions = `
      <p>See the <a href="https://cloudinary.com/documentation/notifications" rel="noopener noreferrer" target="_blank">documentation on Cloudinary</a>.</p>`

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      ${head()}
      ${body({ title, instructions })}
    </html>`

  return ctx.html(html)
})

// https://stackoverflow.com/a/11058858
const str2ab = (str: string) => {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

const ab2str = (ab: ArrayBuffer) => {
  return [...new Uint8Array(ab)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}

// https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#L1027
// https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#L1066
const generateHash = async (str: string, algorithm = 'SHA-1') => {
  const ab = await crypto.subtle.digest(algorithm, str2ab(str))
  return ab2str(ab)
}

app.post('/', async (ctx) => {
  const host = ctx.req.headers.get('host')

  const x_cld_signature = ctx.req.headers.get('X-Cld-Signature')
  if (!x_cld_signature) {
    return ctx.json({ error: 'Missing X-Cld-Signature header' }, 400)
  }

  const x_cld_timestamp = ctx.req.headers.get('X-Cld-Timestamp')
  if (!x_cld_timestamp) {
    return ctx.json({ error: 'Missing X-Cld-Timestamp header' }, 400)
  }

  // const api_key = ctx.env.CLOUDINARY_API_KEY
  // if (!api_key) {
  //   return ctx.json(
  //     { error: 'environment variable CLOUDINARY_API_KEY not set' },
  //     503
  //   )
  // }

  const api_secret = ctx.env.CLOUDINARY_WEBHOOK_SECRET
  if (!api_secret) {
    return ctx.json(
      { error: 'environment variable CLOUDINARY_WEBHOOK_SECRET not set' },
      503
    )
  }

  const req_body_as_string = await ctx.req.text()

  const payload = `${req_body_as_string}${x_cld_timestamp}${api_secret}`
  const algorithm = 'SHA-1'
  const payload_hash = await generateHash(payload, algorithm)

  // https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib/utils/index.js#L1079

  // const valid = cloudinary.utils.verifyNotificationSignature(
  //   data,
  //   parseInt(x_cld_timestamp, 10),
  //   x_cld_signature
  // )

  // https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib-es5/auth_token.js#L14
  // https://github.com/cloudinary/cloudinary_npm/blob/ab69f5c3c63d0ef002ba131ea4bb52ec8cbd11ca/lib-es5/auth_token.js#L14
  const key = await hmacKey(api_secret)

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    str2ab(x_cld_signature),
    str2ab(payload_hash)
  )

  const computed_sig_ab = await crypto.subtle.sign('HMAC', key, str2ab(payload))
  const computed_sig_str = ab2str(computed_sig_ab)

  // const webhook_event = ctx.req.valid('json') as WebhookEvent
  // const audit_trail = ctx.get(VariablesEnum.WebhookDebugKey)

  let text = ``
  text = text.concat(
    `<b>${Emoji.Warning} received a webhook event not handled by this app</b>`
  )

  text = text.concat('\n\n')
  text = text.concat(
    `<b>Payload (hashed) matches X-Cld-Signature?</b> ${valid ? 'Yes' : 'No'}`
  )

  const info = {
    valid,
    [`payload (${algorithm})`]: payload_hash,
    'computed signature': computed_sig_str,
    'X-Cld-Signature': x_cld_signature,
    'X-Cld-Timestamp': x_cld_timestamp
  }
  text = text.concat('\n\n')
  text = text.concat(`<pre><code>${JSON.stringify(info, null, 2)}</code></pre>`)

  const webhook_event = JSON.parse(req_body_as_string)

  // text = text.concat('\n\n')
  // text = text.concat(`<pre><code>${req_body_as_string}</code></pre>`)

  text = text.concat('\n\n')
  text = text.concat(
    `<pre><code>${JSON.stringify(webhook_event, null, 2)}</code></pre>`
  )

  // text = text.concat('\n\n')
  // text = text.concat(
  //   `${Emoji.Hook} <i>${audit_trail.summary}</i> - <i>webhook event processed by ${host}</i>`
  // )

  const { telegram } = ctx.env.eventContext.data
  const { failures, successes, warnings } = await telegram.sendMessage(text)

  //   await logAuditTrail(ctx)
  //   await sendAuditTrailToTelegram(ctx)

  let response_payload: object
  if (failures.length === 0) {
    response_payload = {
      message: `Cloudinary webhook processed successfully`,
      successes,
      warnings
    }
  } else {
    response_payload = {
      message: `failed to process Cloudinary webhook`,
      failures,
      warnings
    }
  }

  return ctx.json(response_payload)
})

export const onRequest = handle(app)
