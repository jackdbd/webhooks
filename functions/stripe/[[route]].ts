import { Hono, Context } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import Stripe from "stripe";
import { zValidator } from "@hono/zod-validator";
import { handle } from "hono/cloudflare-pages";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import type { AppEventContext } from "../_middleware.js";
import { Emoji } from "../_utils.js";

interface StripeMiddlewareConfig {
  api_key?: string;
  stripe_config: Stripe.StripeConfig;
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

    (ctx.req as any).validateWebhookEvent = validateWebhookEvent;

    await next();
  };
};

interface TextDetailsConfig {
  event: Stripe.Event;
  resource_type: string;
  resource_id: string;
}

export const anchor = (link: { href: string; text: string }) =>
  `<a href="${link.href}">${link.text}</a>`;

const textDetails = ({
  event,
  resource_id,
  resource_type,
}: TextDetailsConfig) => {
  const href = event.livemode
    ? `https://dashboard.stripe.com/${resource_type}/${resource_id}`
    : `https://dashboard.stripe.com/test/${resource_type}/${resource_id}`;

  const date_str = new Date(event.created * 1000).toUTCString();

  return [
    `API version: ${event.api_version}`,
    `Created: ${event.created} (${date_str})`,
    anchor({ href, text: resource_id }),
  ];
};

// https://emojipedia.org/
// enum Emoji {
//   Coin = "🪙",
//   CreditCard = "💳",
//   Customer = "👤",
//   DollarBanknote = "💵",
//   Error = "🚨",
//   Failure = "❌",
//   Hook = "🪝",
//   Inspect = "🔍",
//   Invalid = "❌",
//   MoneyBag = "💰",
//   Notification = "💬",
//   ShoppingBags = "🛍️",
//   Ok = "✅",
//   Sparkles = "✨",
//   Success = "✅",
//   Timer = "⏱️",
//   User = "👤",
//   Warning = "⚠️",
// }

const app = new Hono();

const stripe_config: Stripe.StripeConfig = {
  // https://stripe.com/docs/api/versioning
  apiVersion: "2022-11-15", // as Stripe.LatestApiVersion
  maxNetworkRetries: 3,
  timeout: 10000, // ms
};

// https://github.com/honojs/hono/tree/main/src/middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", stripeWebhooks({ stripe_config }));

app.notFound((ctx) => ctx.json({ message: "Not Found", ok: false }, 404));

const schema = z.object({
  id: z.string().nonempty(),
  object: z.enum(["event"]),
  api_version: z.string().nonempty(),
  created: z.number(),
  data: z.object({
    object: z.object({
      id: z.string().nonempty(),
      object: z.string().nonempty(),
    }),
  }),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z.object({
    id: z.string().nonempty(),
    idempotency_key: z.string().nonempty(),
  }),
  type: z.string().nonempty(),
});

// https://developers.cloudflare.com/pages/platform/functions/routing/
// https://developers.cloudflare.com/pages/platform/functions/api-reference/

app.get("/", (ctx) => {
  return ctx.json({
    message: "Hello, Stripe! GET",
  });
});

app.post("/", zValidator("json", schema), async (ctx) => {
  if (!ctx.env) {
    throw new Error(`ctx.env is not defined`);
  }

  const validated = ctx.req.valid("json");

  // const validate_webhooks = false;
  const validate_webhooks = true;

  let event: Stripe.Event;
  if (validate_webhooks) {
    const fn = (ctx.req as any).validateWebhookEvent as ValidateWebhookEvent;
    const { error, value } = await fn(ctx);
    if (error) {
      return ctx.json({ message: "Bad Request" }, 400);
    } else {
      event = value;
    }
  } else {
    const warnings = [
      `Environment variable BYPASS_WEBHOOK_VALIDATION was set`,
      `This should be used ONLY in development`,
      `NEVER set BYPASS_WEBHOOK_VALIDATION in production`,
      `ALWAYS validate incoming webhook events in production!`,
    ];
    console.log(warnings.join(". "));
    event = validated;
  }

  // event = (ctx.req as any).stripe_webhook_event;

  // TODO: maybe keep these in a middleware
  const host = ctx.req.headers.get("host");
  const user_agent = ctx.req.headers.get("user-agent");
  const real_ip = ctx.req.headers.get("x-real-ip");
  const forwarded_for = ctx.req.headers.get("x-forwarded-for");
  console.log({ host, user_agent, real_ip, forwarded_for });

  const telegram = (ctx.env.eventContext as AppEventContext).data.telegram;

  let text = "";
  switch (event.type) {
    case "customer.created":
    case "customer.deleted":
    case "customer.updated": {
      const resource_id = (event.data.object as any).id as string;
      text = [
        `${Emoji.Customer} ${Emoji.Hook} <b>Stripe webhook event</b> <code>${event.type}</code> (${host})`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: "customers", resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`,
      ].join("\n\n");
      break;
    }

    case "payment_intent.succeeded": {
      const resource_id = (event.data.object as any).id as string;
      text = [
        `${Emoji.MoneyBag} ${Emoji.Hook} Stripe webhook event <code>${event.type}</code>`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: "payments", resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`,
      ].join("\n\n");
      break;
    }

    case "price.created": {
      const resource_id = (event.data.object as any).id as string;

      text = [
        `${Emoji.DollarBanknote} Stripe webhook event <code>${event.type}</code>`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: "prices", resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`,
      ].join("\n\n");
      break;
    }

    case "product.created":
    case "product.deleted": {
      const resource_id = (event.data.object as any).id as string;

      text = [
        `${Emoji.ShoppingBags} Stripe webhook event <code>${event.type}</code>`,
        `Resourse ID <code>${resource_id}</code>`,
        ...textDetails({ resource_type: "products", resource_id, event }),
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`,
      ].join("\n\n");
      break;
    }

    default: {
      const event_type = validated.type;
      console.log("=== DEFAULT CASE event_type ===", event_type);
      text = [
        `${Emoji.Warning} ${Emoji.Hook} <b>Stripe webhook event not processed by this app</b> <code>${event.type}</code> (${host})`,
        `<pre><code>${JSON.stringify(event, null, 2)}</code></pre>`,
      ].join("\n\n");
      // return ctx.json({ message: "Bad Request" }, 400);
    }
  }

  const { failures, successes, warnings } = await telegram.sendMessage(text);

  if (failures.length === 0) {
    return ctx.json({
      message: `Stripe webhook processed successfully`,
      successes,
      warnings,
    });
  } else {
    return ctx.json({
      message: `failed to process Stripe webhook`,
      failures,
      warnings,
    });
  }
});

export const onRequest = handle(app, "/stripe");
