import type { Context, Env, Input } from 'hono'
import Stripe from 'stripe'

export enum Emoji {
  Fire = '🔥'
}

export const NAME = 'hono middleware stripe webhooks'
export const PREFIX = `[${Emoji.Fire} ${NAME}]`

export interface Config {
  stripe: Stripe
  endpoint: string
  secret: string
}

export type EnabledWebhookEvents = () => Promise<
  | {
      error: Error
      value?: undefined
      warnings?: undefined
    }
  | { error: undefined; value: string[]; warnings: string[] }
>

export const makeEnabledWebhookEvents = (
  config: Config
): EnabledWebhookEvents => {
  const { endpoint, stripe } = config
  console.log({
    message: `${PREFIX}: create enabledWebhookEvents function`,
    endpoint
  })

  return async function enabledWebhookEvents() {
    let we_all: Stripe.ApiList<Stripe.WebhookEndpoint>
    try {
      we_all = await stripe.webhookEndpoints.list()
    } catch (err: any) {
      return {
        error: new Error(
          `${PREFIX}: could not retrieve list of webhook endpoints: ${err.message}`
        )
      }
    }

    const we_matching_url = we_all.data.filter((d) => d.url === endpoint)

    if (we_matching_url.length === 0) {
      return {
        value: [] as string[],
        warnings: [
          `${endpoint} is not among the ${we_all.data.length} webhook endpoints that your Stripe account is allowed to send events to. Maybe you initialized this middleware using a Stripe client in TEST mode and the webhook endpoint in Stripe LIVE, or vice versa?`
        ]
      }
    } else {
      return { value: we_matching_url[0].enabled_events, warnings: [] }
    }
  }
}

type ValidateWebhookEvent<
  E extends Env = Env,
  P extends string = any,
  I extends Input = {}
> = (ctx: Context<E, P, I>) => Promise<
  | {
      error: Error
      value?: undefined
    }
  | { error: undefined; value: Stripe.Event }
>

const makeValidateWebhookEvent = (config: Config): ValidateWebhookEvent => {
  const { endpoint, secret, stripe } = config
  console.log({
    message: `${PREFIX}: create validateWebhookEvent function`,
    endpoint,
    secret
  })

  return async function validateWebhookEvent(ctx) {
    const stripe_signature = ctx.req.headers.get('stripe-signature')

    if (!stripe_signature) {
      const message = `request lacks required header: stripe-signature`

      console.log({
        message: `${PREFIX}: ${message} `,
        required_header: 'stripe-signature',
        headers: ctx.req.headers
      })

      // this is a client error, not an application error. We log it and return
      // 400 bad request without telling anything more to the client. We do NOT
      // want to tell the client that we require the 'stripe-signature' header.

      return { error: new Error(message) }
    }

    let raw_req_body: string
    try {
      raw_req_body = await ctx.req.text()
    } catch (err: any) {
      const message = `could not read raw request body`

      console.log({
        message: `${PREFIX}: ${message} `,
        original_error_message: err.message
      })

      return { error: new Error(message) }
    }

    // I thought I had to provide a custom implementation for cryptoProvider,
    // because I am getting this error:
    // SubtleCryptoProvider cannot be used in a synchronous context
    // https://github.com/stripe/stripe-node/issues/997
    // https://stackoverflow.com/questions/57626477/using-javascript-crypto-subtle-in-synchronous-function
    // Turns out I can simply call stripe.webhooks.constructEventAsync instead
    // of webhooks.constructEvent.

    // https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts

    try {
      const event = await stripe.webhooks.constructEventAsync(
        raw_req_body,
        stripe_signature,
        secret
      )
      return { value: event }
    } catch (err: any) {
      const message = `could not construct webhook event`

      console.log({
        message: `${PREFIX}: ${message} `,
        original_error_message: err.message
      })

      return { error: new Error(message) }
    }
  }
}

export type Client<
  E extends Env = Env,
  P extends string = any,
  I extends Input = {}
> = {
  enabledWebhookEvents: EnabledWebhookEvents
  validateWebhookEvent: ValidateWebhookEvent<E, P, I>
}

export const makeClient = (config: Config) => {
  return {
    enabledWebhookEvents: makeEnabledWebhookEvents(config),
    validateWebhookEvent: makeValidateWebhookEvent(config)
  }
}
