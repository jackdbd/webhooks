import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'
import type { Env } from '../_environment.js'
import { head, body } from '../_html.js'
import {
  Emoji,
  badRequest,
  hmacKey,
  hexStringToArrayBuffer,
  internalServerError
} from '../_utils.js'
import { post_request_body } from './_schemas.js'
import type { CalWebhookEvent } from './_schemas.js'

const PREFIX = `${Emoji.SpeakingHead} [cal.com-webhooks-plugin]`

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

export const onRequestPost: PagesFunction<
  Env,
  any,
  Record<'telegram', TelegramClient>
> = async (ctx) => {
  if (!ctx.env.CAL_WEBHOOKS_SECRET) {
    return internalServerError(
      'missing required environment variable in request context'
    )
  }

  // cal.com uses a hex string as the signature. See here:
  // https://github.com/calcom/cal.com/blob/1b68cc139f212ab2d3fc2490844561b1a587ad5b/packages/features/webhooks/lib/sendPayload.ts#L140
  const signature_as_hex = ctx.request.headers.get('X-Cal-Signature-256')
  if (!signature_as_hex) {
    return badRequest('missing webhook signature')
  }

  const user_agent = ctx.request.headers.get('user-agent')

  const host = ctx.request.headers.get('host')

  // https://community.cloudflare.com/t/how-do-i-read-the-request-body-as-json/155393/2
  // TODO: I need to read the request body twice, but probably I can avoid cloning the request.
  // const [bodyOne, bodyTwo] = ctx.request.body?.tee()
  const req = ctx.request.clone()

  const body = await ctx.request.json()
  const result = post_request_body.safeParse(body)

  if (!result.success) {
    const err = result.error
    console.log({
      message: `${PREFIX} Zod validation error`,
      errors: err.errors,
      issues: err.issues
    })
    return badRequest('invalid cal.com webhook event')
  }

  const validated = body as CalWebhookEvent

  // Verify the authenticity of the received payload
  // https://cal.com/docs/core-features/webhooks#verifying-the-authenticity-of-the-received-payload
  // 1. Use the secret key to create an HMAC
  // 2. Update the HMAC with the webhook payload received to create an SHA256
  // 3. Compare the SHA256 received in the header of the webhook (X-Cal-Signature-256) with the one created using the secret key and the body of the payload.

  // https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
  // https://developers.cloudflare.com/workers/examples/signing-requests/

  const key = await hmacKey(ctx.env.CAL_WEBHOOKS_SECRET)

  const request_payload = await req.arrayBuffer()

  // We need to convert the signature from hex to an ArrayBuffer
  const signature = hexStringToArrayBuffer(signature_as_hex)
  // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    request_payload
  )

  // This check is just for debugging purposes, to show that we obtain the same
  // signature as cal.com
  const my_signature = await crypto.subtle.sign('HMAC', key, request_payload)

  const decoder = new TextDecoder('utf-8')
  console.log({
    message: `${PREFIX} check whether signatures match`,
    verified,
    cal_com_signature_as_hex: signature_as_hex,
    cal_com_signature_decoded: decoder.decode(signature),
    my_signature_decoded: decoder.decode(my_signature),
    user_agent
  })

  const verified_info = verified
    ? `<i>the event was sent by cal.com </i> ${Emoji.Valid}`
    : `<i>the event was <b>NOT</b> sent by cal.com</i> ${Emoji.Invalid}`

  const telegram = ctx.data.telegram

  let text = ``
  switch (validated.triggerEvent) {
    case 'BOOKING_CANCELLED': {
      const { cancellationReason, title } = validated.payload
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
      } = validated.payload

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
      const { rescheduleUid, responses, title, uid } = validated.payload
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
        `<pre><code>${JSON.stringify(validated, null, 2)}</code></pre>`
      )
    }
  }

  text = text.concat('\n\n')
  text = text.concat(
    `${Emoji.Hook} <i>event handled by ${host}</i> - ${verified_info}`
  )

  console.log({
    message: `${PREFIX} triggerEvent ${validated.triggerEvent} createdAt ${validated.createdAt}`,
    payload: validated.payload,
    telegram_text: text
  })
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
