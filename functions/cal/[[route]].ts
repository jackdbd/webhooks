import { Hono, type Env } from 'hono'
import { handle, type EventContext } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import {
  AppEnvironment,
  EnvVarsEnum,
  EventContextData
} from '../_environment.js'
import { notFound, onError } from '../_hono-handlers.js'
import { webhooksMiddleware } from '../_hono-webhooks-middleware/_middleware.js'
import { body, head } from '../_html.js'
import { Emoji } from '../_utils.js'
import { post_request_body, type CalWebhookEvent } from './_schemas.js'

/**
 * Bindings available in this Hono app.
 */
type Bindings = {
  [key in EnvVarsEnum]: string | undefined
} & { eventContext: EventContext<AppEnvironment, any, EventContextData> }

enum VariablesEnum {
  VerificationMessageVar = 'cal.com-webhook-verification-message'
}

/**
 * Variables available in this Hono app.
 */
type Variables = {
  [key in VariablesEnum]: string
}

interface Environment extends Env {
  Bindings: Bindings
  Variables: Variables
}

const app = new Hono<Environment>().basePath('/cal')
app.use('*', logger())
app.use('*', prettyJSON())
app.use(
  '*',
  webhooksMiddleware({
    env_var: EnvVarsEnum.SecretForCalComWebhooks,
    header: 'X-Cal-Signature-256',
    schema: post_request_body,
    verification_message_var: VariablesEnum.VerificationMessageVar
  })
)

app.notFound(notFound)
app.onError(onError)

app.get('/', async (ctx) => {
  const title = `Cal.com webhooks`

  const instructions = `
    <p>Receive meeting data in real-time when something happens in Cal.com</p>
    <p>See the <a href="https://cal.com/docs/core-features/webhooks" rel="noopener noreferrer" target="_blank">documentation on cal.com</a><p>`

  const html = `
  <!DOCTYPE html>
  <html lang="en">
    ${head()}
    ${body({ title, instructions })}
  </html>`

  return ctx.html(html)
})

app.post('/', async (ctx) => {
  const host = ctx.req.headers.get('host')

  const webhook_event = ctx.req.valid('json') as CalWebhookEvent
  const verification_message = ctx.get(VariablesEnum.VerificationMessageVar)

  let text = ``
  switch (webhook_event.triggerEvent) {
    case 'BOOKING_CANCELLED': {
      const { cancellationReason, title } = webhook_event.payload
      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} cancelled</b>`
      )
      text = text.concat('\n\n')
      text = text.concat('Cancellation reason:')
      text = text.concat('\n')
      text = text.concat(cancellationReason || 'Not provided')
      break
    }
    case 'BOOKING_CREATED': {
      const {
        additionalNotes,
        attendees,
        customInputs,
        endTime,
        startTime,
        title,
        uid
      } = webhook_event.payload

      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} created</b>`
      )

      text = text.concat('\n\n')
      const url = `https://app.cal.com/booking/${uid}`
      text = text.concat(`<a href="${url}">${title}</a>`)

      text = text.concat('\n\n')
      text = text.concat('Time (GMT):')
      text = text.concat('\n')
      text = text.concat(`${startTime} - ${endTime}`)

      text = text.concat('\n\n')
      text = text.concat('Attendees:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(attendees, null, 2)}</code></pre>`
      )

      text = text.concat('\n\n')
      text = text.concat('Custom inputs:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(customInputs, null, 2)}</code></pre>`
      )

      text = text.concat('\n\n')
      text = text.concat('Additional notes:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(additionalNotes, null, 2)}</code></pre>`
      )
      break
    }
    case 'BOOKING_RESCHEDULED': {
      const { responses, title, uid } = webhook_event.payload
      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} rescheduled</b>`
      )

      text = text.concat('\n\n')
      const url = `https://app.cal.com/booking/${uid}`
      text = text.concat(`<a href="${url}">${title}</a>`)

      // This is a valid URL but I'm not sure what it does to the booking
      // text = text.concat('\n\n')
      // const reschedule_url = `https://app.cal.com/reschedule/${rescheduleUid}`
      // text = text.concat(`<a href="${reschedule_url}">Reschedule ${title}</a>`)

      text = text.concat('\n\n')
      text = text.concat('Reschedule reason:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(
          responses.rescheduleReason,
          null,
          2
        )}</code></pre>`
      )
      break
    }
    default: {
      text = text.concat(
        `<b>${Emoji.Warning} received a webhook event not handled by this app</b>`
      )
      text = text.concat('\n\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(webhook_event, null, 2)}</code></pre>`
      )
    }
  }

  text = text.concat('\n\n')
  text = text.concat(
    `${Emoji.Hook} <i>${verification_message}</i> - <i>webhook event processed by ${host}</i>`
  )

  const { telegram } = ctx.env.eventContext.data

  const { failures, successes, warnings } = await telegram.sendMessage(text)

  let response_payload: object
  if (failures.length === 0) {
    response_payload = {
      message: `cal.com webhook processed successfully`,
      successes,
      warnings
    }
  } else {
    response_payload = {
      message: `failed to process cal.com webhook`,
      failures,
      warnings
    }
  }

  return ctx.json(response_payload)
})

export const onRequest = handle(app)
