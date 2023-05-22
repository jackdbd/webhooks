import { Context } from "hono";
import type { MiddlewareHandler } from "hono";
import Stripe from "stripe";
import { enabledEventsForWebhookEndpoint } from "./_utils.js";

interface StripeMiddlewareConfig {
  api_key?: string;
  stripe_config: Stripe.StripeConfig;
  webhook_endpoint: string;
  webhook_secret?: string;
}

export type ValidateWebhookEvent = (
  ctx: Context
) => Promise<
  | { error: Error; value?: undefined }
  | { error?: undefined; value: Stripe.Event }
>;

export const stripeWebhooks = ({
  api_key,
  stripe_config,
  webhook_endpoint,
  webhook_secret,
}: StripeMiddlewareConfig): MiddlewareHandler => {
  let client: Stripe;
  let stripe_api_key: string;
  let secret: string;

  return async (ctx, next) => {
    if (!client) {
      if (api_key) {
        stripe_api_key = api_key;
      } else {
        if (ctx.env.STRIPE_API_KEY) {
          stripe_api_key = ctx.env.STRIPE_API_KEY;
        } else {
          const arr = [
            `Environment variable STRIPE_API_KEY is not defined in this EventContext.`,
            `Be sure to set it in your .dev.vars file and in your Cloudflare project.`,
          ];
          throw new Error(arr.join(" "));
        }
      }

      client = new Stripe(stripe_api_key, stripe_config);
    }

    if (webhook_secret) {
      secret = webhook_secret;
    } else {
      if (ctx.env.STRIPE_WEBHOOK_SECRET) {
        secret = ctx.env.STRIPE_WEBHOOK_SECRET;
      } else {
        const arr = [
          `Environment variable STRIPE_WEBHOOK_SECRET is not defined in this EventContext.`,
          `Be sure to set it in your .dev.vars file and in your Cloudflare project.`,
        ];
        throw new Error(arr.join(" "));
      }
    }

    // READ THIS!
    // https://community.cloudflare.com/t/wrangler-with-stripe-error/447825/2
    // https://jross.me/verifying-stripe-webhook-signatures-cloudflare-workers/

    const validateWebhookEvent: ValidateWebhookEvent = async (ctx) => {
      const stripe_signature = ctx.req.headers.get("stripe-signature");

      if (!stripe_signature) {
        const message = `request lacks required header: stripe-signature`;

        console.log({
          message,
          required_header: "stripe-signature",
          headers: ctx.req.headers,
        });

        // this is a client error, not an application error. We log it and return
        // 400 bad request without telling anything more to the client. We do NOT
        // want to tell the client that we require the 'stripe-signature' header.

        return { error: new Error(message) };
      }

      let raw_req_body: string;
      try {
        raw_req_body = await ctx.req.text();
      } catch (err: any) {
        const message = `could not read raw request body`;

        console.log({
          message,
          original_error_message: err.message,
        });

        return { error: new Error(message) };
      }

      // I thought I had to provide a custom implementation for cryptoProvider,
      // because I am getting this error:
      // SubtleCryptoProvider cannot be used in a synchronous context
      // https://github.com/stripe/stripe-node/issues/997
      // https://stackoverflow.com/questions/57626477/using-javascript-crypto-subtle-in-synchronous-function
      // Turns out I can simply call stripe.webhooks.constructEventAsync instead
      // of webhooks.constructEvent.

      try {
        const event = await client.webhooks.constructEventAsync(
          raw_req_body,
          stripe_signature,
          secret
        );
        return { value: event };
      } catch (err: any) {
        const message = `could not construct webhook event`;

        console.log({
          message,
          original_error_message: err.message,
        });

        return { error: new Error(message) };
      }
    };

    const enabledWebhookEvents = async (url: string) => {
      return await enabledEventsForWebhookEndpoint({ stripe: client, url });
    };

    (ctx.req as any).stripe_webhook_endpoint = webhook_endpoint;
    (ctx.req as any).enabledWebhookEvents = enabledWebhookEvents;
    (ctx.req as any).validateWebhookEvent = validateWebhookEvent;

    await next();
  };
};
