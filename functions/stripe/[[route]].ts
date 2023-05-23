import { Hono } from 'hono'
import Stripe from 'stripe'
import { zValidator } from '@hono/zod-validator'
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
import { stripeWebhooks } from '../_hono-middlewares.js'
import type { ValidateWebhookEvent } from '../_hono-middlewares.js'
import { post_request_body } from './_schemas.js'

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

const stripe_config: Stripe.StripeConfig = {
  // https://stripe.com/docs/api/versioning
  apiVersion: '2022-11-15', // as Stripe.LatestApiVersion
  maxNetworkRetries: 3,
  timeout: 10000 // ms
}

// https://github.com/honojs/hono/tree/main/src/middleware
app.use('*', logger())
app.use('*', prettyJSON())
app.use(
  '*',
  stripeWebhooks({
    stripe_config,
    webhook_endpoint: 'https://webhooks.giacomodebidda.com/stripe'
  })
)

app.notFound(notFound)
app.onError(onError)

app.get('/', async (ctx) => {
  const webhook_endpoint = (ctx.req as any).stripe_webhook_endpoint as string
  const fn = (ctx.req as any).enabledWebhookEvents as any
  const enabled_events: string[] = await fn(webhook_endpoint)

  const html = `
<!DOCTYPE html>
<html lang="en">
  ${head()}
  ${body({
    title: `Stripe webhooks`,
    instructions: `<p>This Stripe account is configured to POST ${
      enabled_events.length
    } webhook event/s to ${anchor({
      href: webhook_endpoint,
      text: webhook_endpoint
    })}</p>`,
    successes: enabled_events
  })}
</html>`

  return ctx.html(html)
})

app.post('/', zValidator('json', post_request_body), async (ctx) => {
  if (!ctx.env) {
    throw new Error(`ctx.env is not defined`)
  }

  const validated = ctx.req.valid('json')

  // const validate_webhooks = false;
  const validate_webhooks = true

  let event: Stripe.Event
  if (validate_webhooks) {
    const fn = (ctx.req as any).validateWebhookEvent as ValidateWebhookEvent
    const { error, value } = await fn(ctx)
    if (error) {
      return ctx.json({ message: 'Bad Request' }, 400)
    } else {
      event = value
    }
  } else {
    const warnings = [
      `Environment variable BYPASS_WEBHOOK_VALIDATION was set`,
      `This should be used ONLY in development`,
      `NEVER set BYPASS_WEBHOOK_VALIDATION in production`,
      `ALWAYS validate incoming webhook events in production!`
    ]
    console.log(warnings.join('. '))
    event = validated
  }

  // TODO: maybe keep these in a middleware
  const host = ctx.req.headers.get('host')
  const user_agent = ctx.req.headers.get('user-agent')
  const real_ip = ctx.req.headers.get('x-real-ip')
  const forwarded_for = ctx.req.headers.get('x-forwarded-for')
  console.log({ host, user_agent, real_ip, forwarded_for })

  const telegram = (ctx.env.eventContext as AppEventContext).data.telegram

  const webhook_endpoint = (ctx.req as any).stripe_webhook_endpoint as string
  const eventsForEndpoint = (ctx.req as any).enabledWebhookEvents as any
  const enabled_events: string[] = await eventsForEndpoint(webhook_endpoint)

  if (!enabled_events.includes(event.type)) {
    const message = eventIsIgnoredMessage(event.type, webhook_endpoint)
    return ctx.json({ message: `Bad Request: ${message}` }, 400)
  }

  let text = ''
  switch (event.type) {
    case 'customer.created':
    case 'customer.deleted':
    case 'customer.updated': {
      const resource_id = (event.data.object as any).id as string
      text = [
        `${Emoji.Customer} ${Emoji.Hook} <b>Stripe webhook event</b> <code>${event.type}</code> (${host})`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: 'customers', resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
      ].join('\n\n')
      break
    }

    case 'payment_intent.succeeded': {
      const resource_id = (event.data.object as any).id as string
      text = [
        `${Emoji.MoneyBag} ${Emoji.Hook} Stripe webhook event <code>${event.type}</code>`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: 'payments', resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
      ].join('\n\n')
      break
    }

    case 'price.created': {
      const resource_id = (event.data.object as any).id as string

      text = [
        `${Emoji.DollarBanknote} Stripe webhook event <code>${event.type}</code>`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: 'prices', resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
      ].join('\n\n')
      break
    }

    case 'product.created':
    case 'product.deleted': {
      const resource_id = (event.data.object as any).id as string

      text = [
        `${Emoji.ShoppingBags} Stripe webhook event <code>${event.type}</code>`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: 'products', resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`
      ].join('\n\n')
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
