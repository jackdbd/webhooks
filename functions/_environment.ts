import type { Fetcher } from '@cloudflare/workers-types'
import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'
import type { CalWebhookEvent } from './_cal-com-webhooks-schemas.js'

/**
 * Environment variables I defined for this Cloudflare Pages project.
 *
 * https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables
 */
export interface Env {
  ASSETS: Fetcher
  CAL_WEBHOOKS_SECRET?: string
  PASSWORD?: string
  STRIPE_API_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_WEBHOOK_TEST?: string
  TELEGRAM?: string
  TELEGRAM_CHAT_ID?: string
  TELEGRAM_TOKEN?: string
  USERNAME?: string
}

export interface Data {
  calWebhookEvent: CalWebhookEvent
  telegram: TelegramClient
}

/**
 * Event context available in this Cloudflare Pages Functions app.
 */
export type AppEventContext = EventContext<Env, any, Data>
