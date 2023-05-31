import { Hono } from 'hono'
import Stripe from 'stripe'
import { zValidator } from '@hono/zod-validator'
import { fromZodError } from 'zod-validation-error'
import { handle } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { head, body, anchor } from '../_html.js'
import type { AppEventContext } from '../_environment.js'
import {
  Emoji,
  eventIsIgnoredMessage,
  incorrectRequestBody
} from '../_utils.js'
import { notFound, onError } from '../_hono-handlers.js'
import { badRequest } from '../_hono-utils.js'
import { stripeWebhooks } from '../_hono-middlewares.js'
import type { ValidateWebhookEvent } from '../_hono-middlewares.js'
import { serviceUnavailable } from '../_hono-utils.js'
import { post_request_body } from './_schemas.js'
import { PREFIX } from './_utils.js'

interface TextDetailsConfig {
  event: Stripe.Event
  resource_type: string
  resource_id: string
}

const textDetails = ({
  event,
  resource_id,
  resource_type
}: TextDetailsConfig) => {
  const href = event.livemode
    ? `https://dashboard.stripe.com/${resource_type}/${resource_id}`
    : `https://dashboard.stripe.com/test/${resource_type}/${resource_id}`

  const date_str = new Date(event.created * 1000).toUTCString()

  return [
    `API version: ${event.api_version}`,
    `Created: ${event.created} (${date_str})`,
    anchor({ href, text: resource_id })
  ]
}

const app = new Hono().basePath('/stripe')

// See some Hono middleware here:
// https://github.com/honojs/hono/tree/main/src/middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', stripeWebhooks())

app.notFound(notFound)
app.onError(onError)

app.get('/', async (ctx) => {
  console.log({ message: `${PREFIX}: GET /stripe before endpoint and events` })
  const endpoint = (ctx.req as any).stripeWebhookEndpoint as string
  const events = (ctx.req as any).stripeWebhookEventsEnabled as string[]
  console.log({
    message: `${PREFIX}: GET /stripe after endpoint and events`,
    endpoint,
    events
  })

  const content_type = ctx.req.headers.get('content-type')
  if (content_type === 'application/json') {
    return ctx.json({
      message: `This Stripe account is allowed to send ${events.length} webhook events to the endpoint ${endpoint}`,
      endpoint,
      events
    })
  }

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  ${head()}
  ${body({
    title: `Stripe webhooks`,
    instructions: `<p>This Stripe account is configured to POST ${
      events.length
    } webhook event/s to ${anchor({
      href: endpoint,
      text: endpoint
    })}</p>`,
    successes: events
  })}
</html>`

  return ctx.html(html)
})

app.post(
  '/',
  zValidator('json', post_request_body, (result, ctx) => {
    if (!result.success) {
      const err = fromZodError(result.error)
      console.log({
        message: `${PREFIX}: ${err.message}`
        // errors: JSON.stringify(result.error.errors, null, 2),
        // issues: JSON.stringify(result.error.issues, null, 2)
      })
      return badRequest(ctx)
    }
  }),
  async (ctx) => {
    if (!ctx.env) {
      console.log({
        message: `${PREFIX}: ctx.env is not defined`
      })
      return serviceUnavailable(ctx)
    }

    const telegram = (ctx.env.eventContext as AppEventContext).data.telegram

    const validated = ctx.req.valid('json')

    let verify_webhook_event: boolean
    let verified_info
    if (ctx.env.STRIPE_WEBHOOK_SKIP_VERIFICATION === 'true') {
      verify_webhook_event = false
      verified_info = `<i>the event was NOT verified</i>`
    } else {
      verify_webhook_event = true
      verified_info = `<i>the event was verified</i>`
    }

    let event: Stripe.Event
    if (verify_webhook_event) {
      const fn = (ctx.req as any).validateWebhookEvent as ValidateWebhookEvent
      const { error, value } = await fn(ctx)
      if (error) {
        console.log({ message: `${PREFIX}: ${error.message}` })
        return badRequest(ctx)
      } else {
        event = value
      }
    } else {
      console.warn({
        message: `${PREFIX} Stripe webhook event not verified because environment variable STRIPE_WEBHOOK_SKIP_VERIFICATION was set to true`
      })
      event = validated
    }

    // TODO: maybe keep these in a middleware
    const host = ctx.req.headers.get('host')
    const user_agent = ctx.req.headers.get('user-agent')
    const real_ip = ctx.req.headers.get('x-real-ip')
    const forwarded_for = ctx.req.headers.get('x-forwarded-for')
    console.log({ host, user_agent, real_ip, forwarded_for })

    const stripeWebhookEventsEnabled = (ctx.req as any)
      .stripeWebhookEventsEnabled as string[]

    const stripeWebhookEndpoint = (ctx.req as any)
      .stripeWebhookEndpoint as string

    if (!stripeWebhookEventsEnabled.includes(event.type)) {
      const message = eventIsIgnoredMessage(event.type, stripeWebhookEndpoint)
      return badRequest(ctx, `Bad Request: ${message}`)
    }

    let text = ''
    switch (event.type) {
      case 'customer.created':
      case 'customer.deleted':
      case 'customer.updated': {
        const resource_id = (event.data.object as any).id as string

        text = text.concat(`<b>Stripe webhook event</b>`)

        text = text.concat('\n\n')
        text = text.concat(`${Emoji.Customer} <code>${event.type}</code>`)
        text = text.concat('\n')
        text = text.concat(`Resource ID: <code>${resource_id}</code>`)

        text = text.concat('\n\n')
        text = text.concat(
          textDetails({
            resource_type: 'customers',
            resource_id,
            event
          }).join('\n\n')
        )

        text = text.concat('\n\n')
        text = text.concat(
          `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
        )

        break
      }

      case 'payment_intent.succeeded': {
        const resource_id = (event.data.object as any).id as string

        text = text.concat(`<b>Stripe webhook event</b>`)

        text = text.concat('\n\n')
        text = text.concat(`${Emoji.MoneyBag} <code>${event.type}</code>`)
        text = text.concat('\n')
        text = text.concat(`Resource ID: <code>${resource_id}</code>`)

        text = text.concat('\n\n')
        text = text.concat(
          textDetails({
            resource_type: 'payments',
            resource_id,
            event
          }).join('\n\n')
        )

        text = text.concat('\n\n')
        text = text.concat(
          `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
        )

        break
      }

      case 'price.created': {
        const resource_id = (event.data.object as any).id as string

        text = text.concat(`<b>Stripe webhook event</b>`)

        text = text.concat('\n\n')
        text = text.concat(`${Emoji.DollarBanknote} <code>${event.type}</code>`)
        text = text.concat('\n')
        text = text.concat(`Resource ID: <code>${resource_id}</code>`)

        text = text.concat('\n\n')
        text = text.concat(
          textDetails({
            resource_type: 'prices',
            resource_id,
            event
          }).join('\n\n')
        )

        text = text.concat('\n\n')
        text = text.concat(
          `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
        )

        break
      }

      case 'product.created':
      case 'product.deleted': {
        const resource_id = (event.data.object as any).id as string

        text = text.concat(`<b>Stripe webhook event</b>`)

        text = text.concat('\n\n')
        text = text.concat(`${Emoji.ShoppingBags} <code>${event.type}</code>`)
        text = text.concat('\n')
        text = text.concat(`Resource ID: <code>${resource_id}</code>`)

        text = text.concat('\n\n')
        text = text.concat(
          textDetails({
            resource_type: 'products',
            resource_id,
            event
          }).join('\n\n')
        )

        text = text.concat('\n\n')
        text = text.concat(
          `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
        )

        break
      }

      default: {
        const event_type = validated.type
        console.log('=== DEFAULT CASE event_type ===', event_type)

        const message = event_type
          ? `event '${event_type}' not handled (this Stripe account can POST it, but there isn't a handler in this application)`
          : incorrectRequestBody

        console.log(message)

        text = [
          `${Emoji.Warning} ${Emoji.Hook} <b>Stripe webhook event not processed by this app</b> <code>${event.type}</code> (${host})`,
          message,
          `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
        ].join('\n\n')
      }
    }

    text = text.concat('\n\n')
    text = text.concat(
      `${Emoji.Hook} <i>event handled by ${host}</i> - ${verified_info}`
    )

    const { failures, successes, warnings } = await telegram.sendMessage(text)

    if (failures.length === 0) {
      return ctx.json({
        message: `Stripe webhook processed successfully`,
        successes,
        warnings
      })
    } else {
      return ctx.json({
        message: `failed to process Stripe webhook`,
        failures,
        warnings
      })
    }
  }
)

export const onRequest = handle(app)
