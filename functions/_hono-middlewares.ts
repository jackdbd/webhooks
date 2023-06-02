import type { Env, MiddlewareHandler } from 'hono'
import { SafeParseReturnType } from 'zod'
import { fromZodError } from 'zod-validation-error'
import Stripe from 'stripe'
import { makeClient, PREFIX } from './stripe/_utils.js'
import type { Client } from './stripe/_utils.js'
import { badRequest, serviceUnavailable } from './_hono-utils.js'
import { post_request_body } from './stripe/_schemas.js'
import type { StripeWebhookEvent } from './stripe/_schemas.js'

export const eventIsIgnoredMessage = (event_type: string, url: string) =>
  `This Stripe account is not configured to POST ${event_type} events to this endpoint [${url}] so the event is ignored.`

interface StripeMiddlewareConfig {
  stripe_config: Stripe.StripeConfig
  webhook_endpoint?: string
}

// TODO: distinguish between stripe-signature verification and Stripe.Event schema validation
interface Verification {
  verified: boolean
  message: string
}

export interface Environment extends Env {
  Bindings: {
    eventContext: any
    STRIPE_API_KEY?: string
    STRIPE_WEBHOOK_SECRET?: string
    STRIPE_WEBHOOK_SKIP_VERIFICATION?: string
  }
  Variables: {
    stripeWebhookEndpoint: string
    stripeWebhookEventsEnabled: string[]
    stripeWebhookEventVerification: Verification
    'webhook-verification-message': string
  }
}

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
): MiddlewareHandler<Environment, any> => {
  const stripe_config = options?.stripe_config || DEFAULT.stripe_config
  console.log({ message: `${PREFIX} Stripe config`, ...stripe_config })

  let client: Client

  return async (ctx, next) => {
    let api_key: string | undefined = undefined
    let secret: string | undefined = undefined

    if (ctx.env) {
      api_key = ctx.env.STRIPE_API_KEY
      secret = ctx.env.STRIPE_WEBHOOK_SECRET
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

    console.log({
      message: `${PREFIX} debugging a few request headers`,
      host,
      user_agent
    })

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
    }

    const {
      error,
      value: events,
      warnings
    } = await client.enabledWebhookEvents()
    if (error) {
      console.log({
        message: `${PREFIX} ${error.message}`,
        warnings
      })
      return serviceUnavailable(ctx)
    }

    ctx.set('stripeWebhookEndpoint', endpoint)
    console.log({
      message: `${PREFIX} stripeWebhookEndpoint set in request context`
    })

    ctx.set('stripeWebhookEventsEnabled', events)
    console.log({
      message: `${PREFIX} stripeWebhookEventsEnabled set in request context`
    })

    if (ctx.req.method === 'POST') {
      let verification: Verification
      if (ctx.env.STRIPE_WEBHOOK_SKIP_VERIFICATION === 'true') {
        verification = { verified: false, message: `signature NOT verified` }
      } else {
        verification = { verified: true, message: `signature verified` }
      }

      let event: Stripe.Event | undefined = undefined
      if (verification.verified) {
        console.log({ message: `${PREFIX}: verify request signature` })
        const { error, value } = await client.validateWebhookEvent(ctx)
        if (error) {
          console.log({
            message: `${PREFIX}: request signature verification failed: ${error.message}`
          })
          return badRequest(ctx)
        } else {
          console.log({ message: `${PREFIX}: request signature verified` })
          event = value
        }
      } else {
        console.warn({
          message: `${PREFIX} skip request signature verification because environment variable STRIPE_WEBHOOK_SKIP_VERIFICATION is set to true`
        })
      }

      let result: SafeParseReturnType<any, StripeWebhookEvent>

      if (event) {
        console.log({ message: `${PREFIX} validate schema of 'event'` })
        result = post_request_body.safeParse(event)
      } else {
        console.log({ message: `${PREFIX} validate schema of 'ctx.req.body'` })
        const req_payload = await ctx.req.arrayBuffer()
        const decoder = new TextDecoder('utf-8')
        const req_body: Stripe.Event = JSON.parse(decoder.decode(req_payload))
        result = post_request_body.safeParse(req_body)
      }

      if (!result.success) {
        const err = fromZodError(result.error)
        console.log({
          message: `${PREFIX}: ${err.message}`
          // errors: JSON.stringify(result.error.errors, null, 2),
          // issues: JSON.stringify(result.error.issues, null, 2)
        })
        return badRequest(ctx)
      } else {
        console.log({ message: `${PREFIX}: schema validated` })
      }

      if (!events.includes(result.data.type)) {
        const message = `Received a Stripe ${result.data.type} event. Since your Stripe account is not configured to send this type of events to this endpoint (${endpoint}), the event is ignored.`
        return badRequest(ctx, `Bad Request: ${message}`)
      }

      ctx.req.addValidatedData('json', result.data)
      console.log({ message: `${PREFIX} added validated 'json' data` })

      ctx.set('stripeWebhookEventVerification', verification)
      console.log({
        message: `${PREFIX} stripeWebhookEventVerification set in request context`
      })
    }

    // READ THIS!
    // https://community.cloudflare.com/t/wrangler-with-stripe-error/447825/2
    // https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers/

    await next()
  }
}
