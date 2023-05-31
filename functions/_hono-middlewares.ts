import type { Context, Env, Input, MiddlewareHandler } from 'hono'
import Stripe from 'stripe'
import { makeClient, PREFIX } from './stripe/_utils.js'
import type { Client } from './stripe/_utils.js'
import { serviceUnavailable } from './_hono-utils.js'

interface StripeMiddlewareConfig {
  stripe_config: Stripe.StripeConfig
  webhook_endpoint?: string
}

interface Bindings {
  STRIPE_API_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_WEBHOOK_SKIP_VERIFICATION?: string
}

export type ValidateWebhookEvent = (
  ctx: Context
) => Promise<
  | { error: Error; value?: undefined }
  | { error?: undefined; value: Stripe.Event }
>

const DEFAULT = {
  stripe_config: {
    // https://stripe.com/docs/api/versioning
    apiVersion: '2022-11-15', // as Stripe.LatestApiVersion
    maxNetworkRetries: 3,
    timeout: 10000 // ms
  } as Stripe.StripeConfig
}

export const stripeWebhooks = (
  options?: StripeMiddlewareConfig
): MiddlewareHandler<Env, any> => {
  const stripe_config = options?.stripe_config || DEFAULT.stripe_config
  console.log({ message: `${PREFIX} Stripe config`, ...stripe_config })

  let client: Client

  return async (ctx, next) => {
    let api_key: string | undefined = undefined
    let secret: string | undefined = undefined

    // console.log({
    //   message: `${PREFIX} ctx.env.eventContext`,
    //   ctx_env_eventContext: (ctx.env as any).eventContext
    // })

    if (ctx.env) {
      const b = ctx.env as Bindings
      api_key = b.STRIPE_API_KEY
      secret = b.STRIPE_WEBHOOK_SECRET
    }

    if (!api_key) {
      console.log({
        message: `${PREFIX} server misconfiguration: Stripe API key not set`
      })
      return serviceUnavailable(ctx)
    }
    console.log({
      message: `${PREFIX} Stripe API key set using environment variable STRIPE_API_KEY`
    })

    const host = ctx.req.headers.get('host')
    const user_agent = ctx.req.headers.get('user-agent')
    // const real_ip = ctx.req.headers.get('x-real-ip')
    // const forwarded_for = ctx.req.headers.get('x-forwarded-for')
    // const request_path = ctx.req.path
    console.log({
      message: `debugging a few request headers`,
      host,
      user_agent
    })

    // Error: this context has no fetch event
    // const endpoint = ctx.event.request.url
    // TODO: decide how to make it configurable (e.g. `path` in the middleware
    // options? Can I extract it from the Hono ctx somehow?)
    const functionPath = (ctx.env as any).eventContext.functionPath as string
    // const data = (ctx.env as any).eventContext.data
    // const params = (ctx.env as any).eventContext.params
    const endpoint = `https://${host}${functionPath}`

    if (!secret) {
      console.log({
        message: `${PREFIX} server misconfiguration: Stripe webhook endpoint secret not set`
      })
      return serviceUnavailable(ctx)
    }

    if (!client) {
      const stripe = new Stripe(api_key, stripe_config)
      client = makeClient({ stripe, endpoint, secret })
      console.log({ message: `${PREFIX} Stripe webhooks client initialized` })
    }

    let events: string[] = []
    try {
      events = await client.enabledWebhookEvents()
    } catch (err: any) {
      return serviceUnavailable(ctx, err.message)
    }

    ;(ctx.req as any).stripeWebhookEndpoint = endpoint
    console.log({ message: `${PREFIX} added stripeWebhookEndpoint to ctx.req` })
    // or maybe this?
    // (ctx.env as any).eventContext.data.stripeWebhookEndpoint = stripeWebhookEndpoint
    //
    ;(ctx.req as any).stripeWebhookEventsEnabled = events
    console.log({
      message: `${PREFIX} added stripeWebhookEventsEnabled to ctx.req`
    })

    // TODO: do this here if the incoming request is a POST, so the handler already has the validated Stripe webhook event
    ;(ctx.req as any).validateWebhookEvent = client.validateWebhookEvent
    console.log({
      message: `${PREFIX} added validateWebhookEvent to ctx.req`
    })

    // READ THIS!
    // https://community.cloudflare.com/t/wrangler-with-stripe-error/447825/2
    // https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers/

    await next()
  }
}
