import type Stripe from 'stripe'

export interface EnabledEventsForWebhookEndpoint {
  stripe: Stripe
  url: string
}

// https://emojipedia.org/
export enum Emoji {
  ChartDecreasing = '📉',
  Coin = '🪙',
  CreditCard = '💳',
  Customer = '👤',
  DollarBanknote = '💵',
  Error = '🚨',
  Failure = '❌',
  Hook = '🪝',
  Inspect = '🔍',
  Invalid = '❌',
  MoneyBag = '💰',
  Notification = '💬',
  Package = '📦',
  ShoppingBags = '🛍️',
  Ok = '✅',
  Sparkles = '✨',
  SpeakingHead = '🗣️',
  Success = '✅',
  Timer = '⏱️',
  Toolbox = '🧰',
  User = '👤',
  Valid = '✅',
  Warning = '⚠️'
}

const PREFIX = `${Emoji.Toolbox} [utils]`

export const notWebhookEnpointForStripeAccount = (url: string) =>
  `The URL you passed (${url}) is not a Stripe webhook endpoint for this Stripe account. Maybe you passed a Stripe client in TEST mode and a URL which is a webhook endpoint for Stripe in LIVE mode, or vice versa?`

/**
 * List of webhook events that the Stripe account `stripe` is allowed to send to
 * the webhook endpoint `url`.
 *
 * *Note*: you have to configure the events that Stripe sends to a webhook
 * endpoint when you create/update a webhook endpoint in your Stripe account.
 */
export const enabledEventsForWebhookEndpoint = async ({
  stripe,
  url
}: EnabledEventsForWebhookEndpoint) => {
  const we_all = await stripe.webhookEndpoints.list()
  const we_matching_url = we_all.data.filter((d) => d.url === url)
  if (we_matching_url.length === 0) {
    throw new Error(notWebhookEnpointForStripeAccount(url))
  } else {
    return we_matching_url[0].enabled_events
  }
}

export const eventIsIgnoredMessage = (event_type: string, url: string) =>
  `This Stripe account is not configured to POST ${event_type} events to this endpoint [${url}] so the event is ignored.`

export const incorrectRequestBody =
  'Incorrect request body. Received a request body that does not look like a Stripe event.'

export const badRequest = (details?: string) => {
  const message = details ? `Bad Request: ${details}` : `Bad Request`

  return new Response(JSON.stringify({ message }, null, 2), {
    status: 400,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}

export const internalServerError = (details?: string) => {
  const message = details
    ? `Internal Server Error: ${details}`
    : `Internal Server Error`

  return new Response(JSON.stringify({ message }, null, 2), {
    status: 500,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}

/**
 * Use a webhook secret key to create an HMAC.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey
 */
export const hmacKey = async (secret: string) => {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const extractable = false
  const keyUsages = ['sign', 'verify'] as KeyUsage[]

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    extractable,
    keyUsages
  )

  return key
}

export const hexStringToArrayBuffer = (hex: string) => {
  const match_arr = hex.match(/../g)
  if (match_arr) {
    return new Uint8Array(match_arr.map((h) => parseInt(h, 16))).buffer
  } else {
    return new Uint8Array([]).buffer
  }
}

export const defaultOrOptional = <T>(default_value: T, optional_value?: T) => {
  if (optional_value !== undefined) {
    return optional_value!
  } else {
    return default_value
  }
}
