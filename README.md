# webhooks 🪝

Application that I use to process webhook events fired by several services: [Cloud Monitoring](https://cloud.google.com/monitoring/support/notification-options#webhooks), [npm.js](https://docs.npmjs.com/cli/v7/commands/npm-hook), [Stripe](https://stripe.com/docs/webhooks), etc. All webhooks are hosted as a single application on Cloudflare Pages. Some routes are handled by the [Cloudflare Pages Functions routing](https://developers.cloudflare.com/pages/platform/functions/routing/). Some others are handled by [Hono](https://hono.dev/).

> :warning: **Warning:**
>
> Don't use wrangler 3 until [this bug](https://github.com/cloudflare/workers-sdk/issues/3262) is fixed.

## Installation

```sh
npm install
```

## Development

When developing handlers for [Stripe webhooks](https://stripe.com/docs/webhooks), you will need 2 terminals open to develop this application. In all other cases you will need 3 terminals open. I use [Tmux](https://github.com/tmux/tmux/wiki) for this.

### Environment variables & secrets

When developing an app for Cloudflare Workers or Cloudflare Pages with `wrangler dev`, you can set environment variables and secrets in a `.dev.vars` file. This file must be kept in the root directory of your project. Given that some secrets might be JSON strings, I like to keep them the [secrets](./secrets/README.md) directory. Then I generate the `.dev.vars` file using this script:

```sh
node scripts/make-dev-vars.mjs
# in alternative, run this npm script:
npm run make-dev-vars
```

### Stripe webhooks

First of all, create a Stripe webhook endpoint for you Stripe account in **test** mode, and your Stripe account in **live** mode. Double check that you have created and enabled such endpoints:

```sh
stripe webhook_endpoints list --api-key $STRIPE_API_KEY_TEST
stripe webhook_endpoints list --api-key $STRIPE_API_KEY_LIVE
```

In the **first terminal**, run this command, which watches all files using [wrangler](https://github.com/cloudflare/workers-sdk) and forwards all Stripe webhook events to `localhost:8788` using the [Stripe CLI](https://github.com/stripe/stripe-cli):

```sh
npm run dev
```

The main web page will be available at: http://localhost:8788/

In the **second terminal**, [trigger](https://stripe.com/docs/cli/trigger) some Stripe events:

```sh
stripe trigger --api-key $STRIPE_API_KEY_TEST customer.created
stripe trigger --api-key $STRIPE_API_KEY_TEST payment_intent.succeeded
stripe trigger --api-key $STRIPE_API_KEY_TEST price.created
stripe trigger --api-key $STRIPE_API_KEY_TEST product.created

API_KEY=$(cat secrets/stripe-webhook-endpoint-live.json | jq '.api_key') && \
SIGNING_SECRET=$(cat secrets/stripe-webhook-endpoint-live.json | jq '.signing_secret') &&
echo "API key is ${API_KEY} and secret is ${SIGNING_SECRET}"

stripe trigger --api-key $STRIPE_API_KEY_RESTRICTED customer.created
```

Or make some POST requests manually:

POST to the test endpoint without required header and invalid data:

```sh
curl "http://localhost:8788/stripe" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"foo": "bar", "baz": 123}' | jq
```

POST to the test endpoint with the required header but invalid data:

```sh
curl "http://localhost:8788/stripe" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "stripe-signature: foobar" \
  -d '{"foo": "bar", "baz": 123}' | jq
```

POST to the test endpoint with the required header and valid data:

```sh
curl "http://localhost:8788/stripe" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "stripe-signature: foobar" \
  -d "@./assets/webhook-events/stripe/customer-created.json" | jq
```

POST to the live endpoint with invalid data:

```sh
STRIPE_WEBHOOKS_ENDPOINT=$(
  cat secrets/stripe-webhook-endpoint-live.json | jq '.url' | tr -d '"'
) && \
curl $STRIPE_WEBHOOKS_ENDPOINT \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "foo": "bar",
    "baz": 123
  }' | jq
```

Also, send a GET request to see list of all events that Stripe is allowed to send to this endpoint:

```sh
curl "http://localhost:8788/stripe" \
  -X GET \
  -H "Content-Type: application/json" | jq
```

### Instructions for all webhooks except the ones from Stripe

In the **first terminal**, run this command:

```sh
npm run dev
```

The main web page will be available at: http://localhost:8788/

In the **second terminal**, run this command, which create a HTTPS => HTTP tunnel with [ngrok](https://ngrok.com/) on port `8788`:

```sh
ngrok http 8788
# in alternative, run this npm script:
npm run tunnel
```

Now copy the public, **Forwarding URL** that ngrok gave you, and assign it to the `WEBHOOKS_URL` environment variable (for example, paste it in your `.envrc` file and reload it with `direnv allow`). Be sure not to include any trailing slashes.

![Setting up a HTTP tunnel with ngrok](./assets/images/http-tunnel-with-ngrok.png)

> :information_source: **Note:**
>
> Now you can also:
> - visit http://localhost:4040/status to know the public URL ngrok assigned you.
> - visit http://localhost:4040/inspect/http to inspect/replay past requests that were tunneled by ngrok.

In the **third terminal**, make some POST requests simulating webhook events sent by a third-party service. See a few examples below.

### cal.com webhooks

See the [documentation on cal.com](https://cal.com/docs/core-features/webhooks).

![Cal.com webhooks configuration](./assets/images/cal-webhooks.png)

```sh
curl "http://localhost:8788/cal" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"foo": 123, "bar": 456}' | jq
```

```sh
curl "http://localhost:8788/cal" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature-256: hex-string-sent-by-cal.com" \
  -d '{"foo": 123, "bar": 456}' | jq
```

```sh
curl "http://localhost:8788/cal" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature-256: hex-string-sent-by-cal.com" \
  -d "@./assets/webhook-events/cal/booking-created.json" | jq
```

Create a new booking:

```sh
curl "$WEBHOOKS_URL/cal" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature-256: hex-string-sent-by-cal.com" \
  -d "@./assets/webhook-events/cal/booking-created.json" | jq
```

Reschedule a booking:

```sh
curl "$WEBHOOKS_URL/cal" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature-256: hex-string-sent-by-cal.com" \
  -d "@./assets/webhook-events/cal/booking-rescheduled.json" | jq
```

Cancel a booking:

```sh
curl "$WEBHOOKS_URL/cal" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature-256: hex-string-sent-by-cal.com" \
  -d "@./assets/webhook-events/cal/booking-cancelled.json" | jq
```

Event sent by cal.com when a meeting ends:

```sh
curl "$WEBHOOKS_URL/cal" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature-256: hex-string-sent-by-cal.com" \
  -d "@./assets/webhook-events/cal/meeting-ended.json" | jq
```

### Cloudinary webhooks

See the [documentation on Cloudinary](https://cloudinary.com/documentation/notifications).

Missing headers, invalid data:

```sh
curl "http://localhost:8788/cloudinary" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"foo": 123, "bar": 456}' | jq
```

Required headers, invalid data:

```sh
curl "http://localhost:8788/cloudinary" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cld-Signature: signature-sent-by-cloudinary" \
  -H "X-Cld-Timestamp: 1685819601" \
  -d '{"foo": 123, "bar": 456}' | jq
```

Required headers, valid data:

```sh
curl "http://localhost:8788/cloudinary" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cld-Signature: signature-sent-by-cloudinary" \
  -H "X-Cld-Timestamp: 1685819601" \
  -d "@./assets/webhook-events/cloudinary/image-uploaded.json" | jq
```

```sh
curl "$WEBHOOKS_URL/cloudinary" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Cld-Signature: signature-sent-by-cloudinary" \
  -H "X-Cld-Timestamp: 1685819601" \
  -d "@./assets/webhook-events/cloudinary/image-uploaded.json" | jq
```

### Cloud Monitoring webhooks

See the [documentation on Cloud Monitoring](https://cloud.google.com/monitoring/support/notification-options#webhooks).

Missing headers, invalid data:

A [Cloud Monitoring webhook notification channel](https://cloud.google.com/monitoring/support/notification-options#webhooks) supports basic access authentication.

Cloud Monitoring requires your server to return a 401 response with the proper [WWW-Authenticate header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/WWW-Authenticate). So we use `curl --include` or `curl --verbose` to verify that the server returns the `WWW-Authenticate` response header.

```sh
curl "http://localhost:8788/monitoring" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"foo": 123, "bar": 456}' --include
```

Required headers, invalid data:

```sh
curl "http://localhost:8788/monitoring" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $BASE64_ENCODED_BASIC_AUTH" \
  -d '{"foo": 123, "bar": 456}' | jq
```

Required headers, valid data:

```sh
curl "http://localhost:8788/monitoring" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $BASE64_ENCODED_BASIC_AUTH" \
  -d "@./assets/webhook-events/cloud-monitoring/incident-created.json" | jq
```

Required headers, valid data:

```sh
curl "$WEBHOOKS_URL/monitoring" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $BASE64_ENCODED_BASIC_AUTH" \
  -d "@./assets/webhook-events/cloud-monitoring/incident-created.json" | jq
```

### npm.js webhooks

See the [documentation on npm.js](https://docs.npmjs.com/cli/v9/commands/npm-hook).

```sh
curl "$WEBHOOKS_URL/npm" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"foo": 123, "bar": 456}' | jq
```

```sh
curl "$WEBHOOKS_URL/npm" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "x-npm-signature: hex-string-sent-by-npm.js" \
  -d "@./assets/webhook-events/npm/package-changed.json" | jq
```

### WebPageTest pingbacks

See the [documentation on WebPageTest](https://docs.webpagetest.org/integrations/).

```sh
curl "http://localhost:8788/webpagetest?id=some-webpagetest-test-id" \
  -X GET \
  -H "Content-Type: application/json"
```

## Troubleshooting webhooks

Access your Cloudflare Pages Functions logs by using the Cloudflare dashboard or the Wrangler CLI:

```sh
npm run logs
# which is equivalent to:
npx wrangler pages deployment tail --project-name webhooks
```

[See the docs](https://developers.cloudflare.com/pages/platform/functions/debugging-and-logging/) for details.

## Deploy

I enabled automatic deployments, so the application is automatically deployed to Cloudflare Pages on each `git push` (`main` is the production branch, all other branches are `preview` branches).

You can also deploy manually using this command:

```sh
npm run deploy
# which is equivalent to:
wrangler pages publish ./pages
```
