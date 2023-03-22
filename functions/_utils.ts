import type Stripe from "stripe";

export interface EnabledEventsForWebhookEndpoint {
  stripe: Stripe;
  url: string;
}

export const anchor = (link: { href: string; text: string }) =>
  `<a href="${link.href}">${link.text}</a>`;

// https://emojipedia.org/
export enum Emoji {
  ChartDecreasing = "📉",
  Coin = "🪙",
  CreditCard = "💳",
  Customer = "👤",
  DollarBanknote = "💵",
  Error = "🚨",
  Failure = "❌",
  Hook = "🪝",
  Inspect = "🔍",
  Invalid = "❌",
  MoneyBag = "💰",
  Notification = "💬",
  ShoppingBags = "🛍️",
  Ok = "✅",
  Sparkles = "✨",
  Success = "✅",
  Timer = "⏱️",
  User = "👤",
  Warning = "⚠️",
}

export const notWebhookEnpointForStripeAccount = (url: string) =>
  `The URL you passed (${url}) is not a Stripe webhook endpoint for this Stripe account. Maybe you passed a Stripe client in TEST mode and a URL which is a webhook endpoint for Stripe in LIVE mode, or vice versa?`;

/**
 * List of webhook events that the Stripe account `stripe` is allowed to send to
 * the webhook endpoint `url`.
 *
 * *Note*: you have to configure the events that Stripe sends to a webhook
 * endpoint when you create/update a webhook endpoint in your Stripe account.
 */
export const enabledEventsForWebhookEndpoint = async ({
  stripe,
  url,
}: EnabledEventsForWebhookEndpoint) => {
  const we_all = await stripe.webhookEndpoints.list();
  const we_matching_url = we_all.data.filter((d) => d.url === url);
  if (we_matching_url.length === 0) {
    throw new Error(notWebhookEnpointForStripeAccount(url));
  } else {
    return we_matching_url[0].enabled_events;
  }
};

export const eventIsIgnoredMessage = (event_type: string, url: string) =>
  `This Stripe account is not configured to POST ${event_type} events to this endpoint [${url}] so the event is ignored.`;

export const incorrectRequestBody =
  "Incorrect request body. Received a request body that does not look like a Stripe event.";
