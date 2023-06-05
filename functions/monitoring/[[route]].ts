import { Hono } from 'hono'
import type { Env } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { handle } from 'hono/cloudflare-pages'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { zValidator } from '@hono/zod-validator'
import type { AppEventContext } from '../_environment.js'
import { notFound, onError } from '../_hono-handlers.js'
import { Emoji } from '../_utils.js'
import { post_request_body, type MonitoringWebhookEvent } from './_schemas.js'
import { fromZodError } from 'zod-validation-error'
import { badRequest } from '../_hono-utils.js'

interface Environment extends Env {
  Bindings: {
    eventContext: any
    MONITORING_WEBHOOK_SECRET: string
    PASSWORD: string
    USERNAME: string
  }
  Variables: {
    'webhook-verification-message': string
  }
}

const app = new Hono<Environment>().basePath('/monitoring')
app.use('*', logger())
app.use('*', prettyJSON())

app.notFound(notFound)
app.onError(onError)

app.post(
  '/',
  async (ctx, next) => {
    const auth = basicAuth({
      username: ctx.env.USERNAME,
      password: ctx.env.PASSWORD
    })
    try {
      return await auth(ctx, next)
    } catch (ex: any) {
      // ex is a HTTPException
      // https://github.com/honojs/hono/blob/aaa1c6d4b9747fd69b168b30e984b75e4da4b508/src/middleware/basic-auth/index.ts#L68
      // https://github.com/honojs/hono/blob/main/src/http-exception.ts
      return ex.res
    }
  },
  zValidator('json', post_request_body, (result, ctx) => {
    if (!result.success) {
      const err = fromZodError(result.error)
      const cf_ray = ctx.req.headers.get('CF-Ray')

      console.log({
        cf_ray,
        message: err.message,
        timestamp: new Date().getTime()
      })

      // const should_notify_when_bad_request = true
      const should_notify_when_bad_request = false

      if (should_notify_when_bad_request) {
        const telegram = (ctx.env.eventContext as AppEventContext).data.telegram

        ctx.req
          .text()
          .then((req_body) => {
            let text = `<b>${err.name} at <code>${ctx.req.path}</code></b>`

            text = text.concat('\n\n')
            text = text.concat('<b>Request body</b>')
            text = text.concat('\n')
            text = text.concat(`<pre><code>${req_body}</code></pre>`)

            text = text.concat('\n\n')
            text = text.concat('<b>Details</b>')
            const s = JSON.stringify(err.details, null, 2)
            text = text.concat(`<pre><code>${s}</code></pre>`)

            return text
          })
          .then((text) => {
            telegram.sendMessage(text)
          })
          .catch(console.error)
      }

      return badRequest(ctx)
    }
  }),
  async (ctx) => {
    if (!ctx.env) {
      throw new Error(`ctx.env is not defined`)
    }

    const host = ctx.req.headers.get('host')

    const event: MonitoringWebhookEvent = ctx.req.valid('json')

    const webhook_verification_message =
      ctx.get('webhook-verification-message') || 'webhook not verified'

    const incident_summary = event.incident.summary
    const incident_url = event.incident.url
    const policy_name = event.incident.policy_name
    const condition_name = event.incident.condition_name

    const telegram = (ctx.env.eventContext as AppEventContext).data.telegram

    let text = '<b>Cloud Monitoring webhook event</b>'

    text = text.concat('\n\n')
    text = text.concat(
      `${Emoji.ChartDecreasing} Alerting Policy: <code>${policy_name}</code>`
    )
    text = text.concat('\n\n')
    text = text.concat(
      `The alerting policy was triggered because the condition ${condition_name} failed. See <a href="${incident_url}">incident here</a>.`
    )

    text = text.concat('\n\n')
    text = text.concat(`<b>Incident summary</b>`)
    text = text.concat('\n')
    text = text.concat(incident_summary)

    text = text.concat('\n\n')
    text = text.concat(
      `${Emoji.Hook} <i>${webhook_verification_message}</i> - <i>webhook event processed by ${host}</i>`
    )

    const { successes, failures, warnings } = await telegram.sendMessage(text)

    if (failures.length === 0) {
      return ctx.json({
        message: `Cloud Monitoring webhook event processed successfully`,
        successes,
        warnings
      })
    } else {
      return ctx.json({
        message: `failed to process Cloud Monitoring webhook event`,
        failures,
        warnings
      })
    }
  }
)

export const onRequestPost = handle(app)
