import type { D1Database, Fetcher } from '@cloudflare/workers-types'
import type { CalWebhookEvent } from '@jackdbd/cloudflare-pages-plugin-cal-com'
import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'

/**
 * Environment variables which are available whent the application is running on
 * Cloudflare Pages.
 *
 * @see https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables
 */
export interface Env {
  ASSETS: Fetcher

  CAL_WEBHOOKS_SECRET?: string

  /**
   * Cloudflare D1 database. In order to use a D1 database, you first need to
   * create a binding.
   *
   * @see https://developers.cloudflare.com/pages/platform/functions/bindings#d1-databases
   */
  DB: D1Database

  NPM_WEBHOOK_SECRET?: string

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
