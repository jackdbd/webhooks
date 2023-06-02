import { Hono } from 'hono'
import Stripe from 'stripe'
import { handle } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import type { AppEventContext } from '../_environment.js'
import { head, body, anchor } from '../_html.js'
import { Emoji } from '../_utils.js'
import { notFound, onError } from '../_hono-handlers.js'
import { stripeWebhooks } from '../_hono-middlewares.js'
import type { Environment } from '../_hono-middlewares.js'
// import { webhooksMiddleware } from '../_hono-webhooks-middleware/_middleware.js'
import { PREFIX } from './_utils.js'
// import { post_request_body } from './_schemas.js'

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

const app = new Hono<Environment>().basePath('/stripe')

// See some Hono middleware here:
// https://github.com/honojs/hono/tree/main/src/middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use('*', stripeWebhooks())
// app.use(
//   '*',
//   webhooksMiddleware({
//     header: 'stripe-signature',
//     env_var: 'STRIPE_WEBHOOK_SECRET',
//     schema: post_request_body
//   })
// )

app.notFound(notFound)
app.onError(onError)

app.get('/', async (ctx) => {
  console.log({ message: `${PREFIX}: GET /stripe before endpoint and events` })

  const endpoint = ctx.get('stripeWebhookEndpoint')
  const events = ctx.get('stripeWebhookEventsEnabled')

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
    instructions: `<p>This Stripe account is configured to send <b>${
      events.length
    }</b> event/s to the webhook endpoint ${anchor({
      href: endpoint,
      text: endpoint
    })}</p>`,
    successes: events
  })}
</html>`

  return ctx.html(html)
})

app.post('/', async (ctx) => {
  const telegram = (ctx.env.eventContext as AppEventContext).data.telegram

  const event = ctx.req.valid('json') as Stripe.Event
  const webhook_verification_message = ctx.get('webhook-verification-message')
  // const verification = ctx.get('stripeWebhookEventVerification')

  const host = ctx.req.headers.get('host')

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
      const event_type = event.type
      console.log('=== DEFAULT CASE event_type ===', event_type)

      const message = event_type
        ? `event '${event_type}' not handled (this Stripe account can POST it, but there isn't a handler in this application)`
        : 'Incorrect request body. Received a request body that does not look like a Stripe event.'

      console.log(message)

      text = [
        `${Emoji.Warning} ${Emoji.Hook} <b>Stripe webhook event not processed by this app</b> <code>${event.type}</code> (${host})`,
        message,
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
      ].join('\n\n')
    }
  }

  text = text.concat('\n\n')
  // text = text.concat(
  //   `${Emoji.Hook} <i>${verification.message}</i> - <i>event handled by ${host}</i>`
  // )
  text = text.concat(
    `${Emoji.Hook} <i>${webhook_verification_message}</i> - <i>webhook event processed by ${host}</i>`
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
})

export const onRequest = handle(app)
