import type { Fetcher } from "@cloudflare/workers-types";

/**
 * Environment variables I defined for this Cloudflare Pages project.
 *
 * https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables
 */
export interface Env {
  ASSETS: Fetcher;
  PASSWORD?: string;
  STRIPE_API_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_TEST?: string;
  TELEGRAM?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_TOKEN?: string;
  USERNAME?: string;
}
