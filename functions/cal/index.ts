import type { AppEventContext, Env } from '../_environment.js'
import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'
import { head, body } from '../_html.js'
import { Emoji, badRequest } from '../_utils.js'
import { CalWebhookEvent, post_request_body } from './_schemas.js'
// import type { CalWebhookEvent } from './_schemas.js'

export const onRequestGet: PagesFunction<Env> = (_ctx) => {
  const title = `Cal.com webhooks`

  const instructions = `
    <p>Receive meeting data in real-time when something happens in Cal.com</p>
    <p>See the <a href="https://cal.com/docs/core-features/webhooks" rel="noopener noreferrer" target="_blank">documentation on cal.com</a><p>`

  const html = `
  <!DOCTYPE html>
  <html lang="en">
    ${head()}
    ${body({ title, instructions })}
  </html>`

  // throw new Error(`This is a test error`);

  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })
}

export const onRequestPost: PagesFunction<
  Env,
  any,
  Record<'telegram', TelegramClient>
> = async (ctx) => {
  const host = ctx.request.headers.get('host')
  const user_agent = ctx.request.headers.get('user-agent')
  const signature = ctx.request.headers.get('X-Cal-Signature-256')
  if (!signature) {
    return badRequest('missing webhook signature')
  }
  console.log(`X-Cal-Signature-256: ${signature}`)
  console.log(`User-Agent: ${user_agent}`)

  // TODO Verifying the authenticity of the received payload
  // https://cal.com/docs/core-features/webhooks#verifying-the-authenticity-of-the-received-payload
  //   const expected_signature = 'foo'
  //   if (signature != expected_signature) {
  //     return badRequest('invalid webhook signature')
  //   }

  const body = await ctx.request.json()
  const result = post_request_body.safeParse(body)

  if (!result.success) {
    const err = result.error
    console.log({
      message: `Zod validation error`,
      errors: err.errors,
      issues: err.issues
    })
    return badRequest('invalid cal.com webhook event')
  }

  const validated = body as CalWebhookEvent

  const telegram = ctx.data.telegram

  let text = ``
  switch (validated.triggerEvent) {
    case 'BOOKING_CANCELED': {
      const { title } = validated.payload
      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} canceled</b>`
      )
      text = text.concat('\n\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(validated.payload, null, 2)}</code></pre>`
      )
      break
    }
    case 'BOOKING_CREATED': {
      const {
        additionalNotes,
        attendees,
        customInputs,
        endTime,
        startTime,
        title
      } = validated.payload
      //   const uid = 'p4dn6qFj1NY45ggQftiQcW' // an old booking ID of mine
      const uid = validated.payload.uid
      const url = `https://app.cal.com/booking/${uid}`
      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} created</b>`
      )
      text = text.concat('\n\n')
      text = text.concat(`<a href="${url}">${title}</a>`)

      text = text.concat('\n\n')
      text = text.concat('Time (UTC):')
      text = text.concat('\n')
      text = text.concat(`${startTime} - ${endTime}`)

      text = text.concat('\n\n')
      text = text.concat('Attendees:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(attendees, null, 2)}</code></pre>`
      )

      text = text.concat('\n\n')
      text = text.concat('Custom inputs:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(customInputs, null, 2)}</code></pre>`
      )

      text = text.concat('\n\n')
      text = text.concat('Additional notes:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(additionalNotes, null, 2)}</code></pre>`
      )

      //   text = text.concat('\n\n')
      //   text = text.concat(
      //     `<pre><code>${JSON.stringify(validated.payload, null, 2)}</code></pre>`
      //   )
      break
    }
    default: {
      text = text.concat(
        `<b>${Emoji.Warning} received a webhook event not handled by this app</b>`
      )
      text = text.concat('\n\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(validated, null, 2)}</code></pre>`
      )
    }
  }

  text = text.concat('\n')
  text = text.concat(`${Emoji.Hook} <i>webhook event delivered by ${host}</i>`)

  const { failures, successes, warnings } = await telegram.sendMessage(text)

  let data: object
  if (failures.length === 0) {
    data = {
      message: `cal.com webhook processed successfully`,
      successes,
      warnings
    }
  } else {
    data = {
      message: `failed to process cal.com webhook`,
      failures,
      warnings
    }
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json;charset=UTF-8'
    }
  })
}
