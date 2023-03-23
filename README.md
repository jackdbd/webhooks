# webhooks

Application that I use to process webhook events fired by several services: [Cloud Monitoring](https://cloud.google.com/monitoring/support/notification-options#webhooks), [npm.js](https://docs.npmjs.com/cli/v7/commands/npm-hook), [Stripe](https://stripe.com/docs/webhooks), etc.

## Installation

```sh
npm install
```

## Development

When developing an app for Cloudflare Workers or Cloudflare Pages using `wrangler dev`, you can set environment variables and secrets in a `.dev.vars` file. This file must be kept in the root directory of your project. Given that some secrets might be JSON strings, I like to keep them the [secrets](./secrets/README.md) directory. Then I generate the `.dev.vars` file using this script:

```sh
node scripts/make-dev-vars.mjs
```

When developing handlers for [Stripe webhooks](https://stripe.com/docs/webhooks), you will need 2 terminals open to develop this application. In all other cases you will need 3 terminals open.

### Stripe

In the **first terminal**, run this command, which watches all files using [wrangler](https://github.com/cloudflare/workers-sdk) and forwards all Stripe webhook events to `localhost:8788` using the [Stripe CLI](https://github.com/stripe/stripe-cli):

```sh
npm run dev
```

In the **second terminal**, [trigger](https://stripe.com/docs/cli/trigger) some Stripe events:

```sh
stripe trigger --api-key $STRIPE_API_KEY_TEST customer.created
stripe trigger --api-key $STRIPE_API_KEY_TEST payment_intent.succeeded
stripe trigger --api-key $STRIPE_API_KEY_TEST price.created
stripe trigger --api-key $STRIPE_API_KEY_TEST product.created
```

### Everything else

In the **first terminal**, run this command:

```sh
npm run dev
```

In the **second terminal**, run this command, which create a HTTPS => HTTP tunnel with [ngrok](https://ngrok.com/) on port `8788`:

```sh
ngrok http 8788
```

Now copy the public, **Forwarding URL** that ngrok gave you, and assign it to the `WEBHOOKS_URL` environment variable (for example, paste it in your `.envrc` file and reload it with `direnv allow`). Be sure not to include any trailing slashes.

![http-tunnel-with-ngrok](./assets/images/http-tunnel-with-ngrok.png)

> :information_source: **Note:**
>
> Now you can also:
> - visit http://localhost:4040/status to know the public URL ngrok assigned you.
> - visit http://localhost:4040/inspect/http to inspect/replay past requests that were tunneled by ngrok.

In the **third terminal**, make some POST requests representing webhook events. See a few examples below.

#### Cloud Monitoring

POST request made by [Cloud Monitoring](https://cloud.google.com/monitoring/support/notification-options#webhooks):

```sh
curl "$WEBHOOKS_URL/monitoring" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "@./assets/webhook-events/cloud-monitoring/incident-created.json"
```

#### npm.js

POST request made by a [npm hook](https://docs.npmjs.com/cli/v9/commands/npm-hook):

```sh
curl "$WEBHOOKS_URL/npm" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "@./assets/webhook-events/npm/package-changed.json"
```
