import { Hono, type Env, Context } from 'hono'
import { handle, type EventContext } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { body, head } from '../_html.js'
import { notFound, onError } from '../_hono-handlers.js'
import { Emoji } from '../_utils.js'

/**
 * Bindings available in this Hono app.
 */
type Bindings = {
  [key in EnvVarsEnum]: string | undefined
} & { eventContext: EventContext<AppEnvironment, any, EventContextData> }

/**
 * Variables available in this Hono app.
 */
type Variables = {
  [key in VariablesEnum]: AuditTrail
}

interface Environment extends Env {
  Bindings: Bindings
  Variables: Variables
}

const app = new Hono<Environment>().basePath('/hubspot')
app.use('*', logger())
app.use('*', prettyJSON())

app.notFound(notFound)
app.onError(onError)

app.get('/', async (ctx) => {
  const title = `HubSpot webhooks`

  const instructions = `
    <p>Receive real-time notifications when something happens in <a href="https://www.hubspot.com/" rel="noopener noreferrer" target="_blank">HubSpot</a></p>
    <p>See the <a href="https://developers.hubspot.com/docs/api/webhooks" rel="noopener noreferrer" target="_blank">documentation on developers.hubspot.com</a></p>`

  const html = `
  <!DOCTYPE html>
  <html lang="en">
    ${head()}
    ${body({ title, instructions })}
  </html>`

  return ctx.html(html)
})

app.post('/', async (ctx) => {
  // console.log('=== HubSpot POST ctx.env ===', ctx.env)
  const host = ctx.req.header('host')

  const req_body = await ctx.req.json()
  console.log('=== HubSpot POST ctx.req.json() ===', req_body)

  // const event = ctx.req.valid('json')
  // console.log('=== event ===', event)

  const { telegram } = ctx.env.eventContext.data

  // const webhook_event = (ctx.req as any).valid('json') as HubspotWebhookEvent

  // const audit_trail = ctx.get(VariablesEnum.WebhookDebugKey)

  let text = `<b>${Emoji.Hook} HubSpot webhook</b>`

  text = `${text}\n\n<pre><code>${JSON.stringify(req_body, null, 2)}</code></pre>`

  // switch (webhook_event.triggerEvent) {
  //   case 'CONTACT_CREATED': {
  //     break
  //   }

  //   case 'DEAL_CREATED': {
  //     break
  //   }
  // }

  text = `${text}\n\n<i>webhook event processed by ${host}</i>`

  const { failures, successes, warnings } = await telegram.sendMessage(text)
  // const failures = []
  // const warnings = []
  // const successes = []

  let response_payload: object
  if (failures.length === 0) {
    response_payload = {
      message: `HubSpot webhook processed successfully`,
      successes,
      warnings,
      req_body
    }
  } else {
    response_payload = {
      message: `failed to process HubSpot webhook`,
      failures,
      warnings,
      req_body
    }
  }

  return ctx.json(response_payload)
})

export const onRequest = handle(app)
