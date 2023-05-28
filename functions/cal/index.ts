import type { CalWebhookEvent } from '@jackdbd/cloudflare-pages-plugin-cal-com'
import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'
import type { Env } from '../_environment.js'
import { head, body } from '../_html.js'
import { Emoji } from '../_utils.js'

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

  return new Response(html, {
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })
}

type Data = Record<'calComValidatedWebhookEvent', CalWebhookEvent> &
  Record<'telegram', TelegramClient>

export const onRequestPost: PagesFunction<Env, any, Data> = async (ctx) => {
  const webhook_event = ctx.data.calComValidatedWebhookEvent
  const verified_info = `<i>the event was verified by the cal.com webhooks middleware</i>`
  const telegram = ctx.data.telegram

  const host = ctx.request.headers.get('host')

  let text = ``
  switch (webhook_event.triggerEvent) {
    case 'BOOKING_CANCELLED': {
      const { cancellationReason, title } = webhook_event.payload
      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} cancelled</b>`
      )
      text = text.concat('\n\n')
      text = text.concat('Cancellation reason:')
      text = text.concat('\n')
      text = text.concat(cancellationReason || 'Not provided')
      break
    }
    case 'BOOKING_CREATED': {
      const {
        additionalNotes,
        attendees,
        customInputs,
        endTime,
        startTime,
        title,
        uid
      } = webhook_event.payload

      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} created</b>`
      )

      text = text.concat('\n\n')
      const url = `https://app.cal.com/booking/${uid}`
      text = text.concat(`<a href="${url}">${title}</a>`)

      text = text.concat('\n\n')
      text = text.concat('Time (GMT):')
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
      break
    }
    case 'BOOKING_RESCHEDULED': {
      const { responses, title, uid } = webhook_event.payload
      text = text.concat(
        `<b>${Emoji.SpeakingHead} Meeting ${title} rescheduled</b>`
      )

      text = text.concat('\n\n')
      const url = `https://app.cal.com/booking/${uid}`
      text = text.concat(`<a href="${url}">${title}</a>`)

      // This is a valid URL but I'm not sure what it does to the booking
      // text = text.concat('\n\n')
      // const reschedule_url = `https://app.cal.com/reschedule/${rescheduleUid}`
      // text = text.concat(`<a href="${reschedule_url}">Reschedule ${title}</a>`)

      text = text.concat('\n\n')
      text = text.concat('Reschedule reason:')
      text = text.concat('\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(
          responses.rescheduleReason,
          null,
          2
        )}</code></pre>`
      )
      break
    }
    default: {
      text = text.concat(
        `<b>${Emoji.Warning} received a webhook event not handled by this app</b>`
      )
      text = text.concat('\n\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(webhook_event, null, 2)}</code></pre>`
      )
    }
  }

  text = text.concat('\n\n')
  text = text.concat(
    `${Emoji.Hook} <i>event handled by ${host}</i> - ${verified_info}`
  )

  const { failures, successes, warnings } = await telegram.sendMessage(text)

  let response_payload: object
  if (failures.length === 0) {
    response_payload = {
      message: `cal.com webhook processed successfully`,
      successes,
      warnings
    }
  } else {
    response_payload = {
      message: `failed to process cal.com webhook`,
      failures,
      warnings
    }
  }

  return new Response(JSON.stringify(response_payload, null, 2), {
    headers: {
      'content-type': 'application/json;charset=UTF-8'
    }
  })
}
