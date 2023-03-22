# webhooks

Application that I use to receive webhook events from several services: [Cloud Monitoring](https://cloud.google.com/monitoring/support/notification-options#webhooks), [npm.js](https://docs.npmjs.com/cli/v7/commands/npm-hook), [Stripe](https://stripe.com/docs/webhooks), [WebPageTest](https://docs.webpagetest.org/api/reference), etc.

```sh
npm install
```

```sh
npm run dev
```

```sh
open http://localhost:8788
```

## Development

Forward Stripe webhook events to localhost:8788

### Tunnel

In another terminal, create a HTTPS => HTTP tunnel with [ngrok](https://ngrok.com/) on port 8788:

```sh
ngrok http 8788
```

Then visit http://localhost:4040/status to know the public URL ngrok assigned you, and assign it the `WEBHOOKS_URL` environment variable in the `.envrc`.

You can also visit to http://localhost:4040/inspect/http to inspect/replay past requests that were tunneled by ngrok. I like to keep this page open in a browser tab all the time while I am developing.

### test webhook events from npm.js

List the webhooks registered with npm.js:

```sh
npm hook ls
```

POST request made by a [npm hook](https://docs.npmjs.com/cli/v9/commands/npm-hook):

```sh
curl "$WEBHOOKS_URL/npm" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "@./assets/webhook-events/npm/package-changed.json"
```

### test webhook events from Stripe

POST request made by a [Stripe webhook](https://stripe.com/docs/webhooks):

https://stripe.com/docs/cli/trigger

```sh
stripe trigger --api-key $STRIPE_API_KEY_TEST customer.created
stripe trigger --api-key $STRIPE_API_KEY_TEST payment_intent.succeeded
stripe trigger --api-key $STRIPE_API_KEY_TEST product.created
```
