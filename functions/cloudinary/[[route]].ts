import { Hono, type Env, Context } from 'hono'
import { handle, type EventContext } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { fromZodError } from 'zod-validation-error'
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
import { validRequestFromCloudinary } from '../_hono-webhooks-middleware/_verifiers.js'
import { body, head } from '../_html.js'
import { Emoji } from '../_utils.js'
import { post_request_body, type WebhookEvent } from './_schemas.js'

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

app.post('/', async (ctx) => {
  const host = ctx.req.header('host')

  const { error, value } = await validRequestFromCloudinary(ctx)

  if (error) {
    console.log('=== error.message ===', error.message)
    return ctx.json({ message: 'Bad Request' }, 400)
  }

  const webhook_event = value.req_body as WebhookEvent
  const valid = value.valid
  const info = { ...value.info, Host: host }

  let text = ``
  switch (webhook_event.notification_type) {
    case 'delete': {
      text = text.concat(`<b>${Emoji.Headstone} Resource/s deleted</b>`)
      break
    }
    case 'upload': {
      text = text.concat(`<b>${Emoji.ArrowUp} Resource/s uploaded</b>`)
      break
    }
    default: {
      text = text.concat(
        `<b>${Emoji.Warning} notification_type '${webhook_event.notification_type}' is not handled by this app</b>`
      )
    }
  }

  text = text.concat('\n\n')
  text = text.concat('<b>Coming from Cloudinary and not expired?</b> ')
  text = text.concat(valid ? Emoji.Success : Emoji.Failure)

  text = text.concat('\n\n')
  text = text.concat('<b>Info</b>')
  text = text.concat('\n')
  text = text.concat(`<pre><code>${JSON.stringify(info, null, 2)}</code></pre>`)

  const result = post_request_body.safeParse(webhook_event)

  if (!result.success) {
    const error = fromZodError(result.error)
    text = text.concat('\n\n')
    text = text.concat(
      `${Emoji.Warning} request body does not conform to the schema`
    )
    text = text.concat('\n')
    text = text.concat(`<pre><code>${error.message}</code></pre>`)
  } else {
    text = text.concat('\n\n')
    text = text.concat(`${Emoji.Success} request body conforms to the schema`)
  }

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
  // const credentials = JSON.parse(ctx.env.eventContext.env.TELEGRAM)
  // const { chat_id, token } = credentials

  // const body = {
  //   chat_id,
  //   disable_notification: false,
  //   disable_web_page_preview: false,
  //   parse_mode: 'HTML',
  //   text: 'Testing Cloudflare Pages webhooks'
  // }
  // console.log('=== body ===', body)
  // await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  //   method: 'POST',
  //   body: JSON.stringify(body),
  //   headers: {
  //     'Content-type': `application/json`
  //   }
  // })

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
