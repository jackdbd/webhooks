import type { D1Database, Fetcher } from '@cloudflare/workers-types'
import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'

/**
 * Environment variables available when the application is running on Cloudflare
 * Pages Functions.
 *
 * @see https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables
 */
export enum EnvVarsEnum {
  ApiKeyForStripe = 'STRIPE_API_KEY',
  Password = 'PASSWORD',
  SecretForCalComWebhooks = 'CAL_WEBHOOK_SECRET',
  SecretForNpmJsWebhooks = 'NPM_WEBHOOK_SECRET',
  SecretForStripeWebhooks = 'STRIPE_WEBHOOK_SECRET',
  TelegramCredentialsAsJsonString = 'TELEGRAM',
  Username = 'USERNAME'
}

export interface EventContextData {
  telegram: TelegramClient
}

/**
 * User-defined environment variables + Cloudflare bindings available when the
 * application is running on Cloudflare Pages Functions.
 */
export type AppEnvironment = {
  [key in EnvVarsEnum]: string
} & {
  /**
   * Cloudflare static assets fetcher.
   *
   * @see https://developers.cloudflare.com/pages/platform/functions/api-reference/#envassetsfetch
   */
  ASSETS: Fetcher

  /**
   * Cloudflare D1 database. In order to use a D1 database, you first need to
   * create a binding.
   *
   * @see https://developers.cloudflare.com/pages/platform/functions/bindings#d1-databases
   */
  DB: D1Database
}

/**
 * Event context available in this Cloudflare Pages Functions app.
 */
export type AppEventContext = EventContext<
  AppEnvironment,
  any,
  EventContextData
>
