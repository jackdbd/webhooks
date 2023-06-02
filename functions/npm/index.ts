import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'
import type { AppEventContext, Env } from '../_environment.js'
import { head, body } from '../_html.js'
import { Emoji } from '../_utils.js'
import type { NpmWebhookEvent } from './_schemas.js'

export const onRequestGet = async (ctx: AppEventContext) => {
  const title = `How to list your npm hooks`

  const instructions = `
  <p>You can use this command to list all of your npm hooks:</p>
  <pre><code>npm hook ls</code></pre>
  <p>See the <a href="https://docs.npmjs.com/cli/v9/commands/npm-hook" rel="noopener noreferrer" target="_blank">documentation on npm.js</a><p>
`

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

type Data = Record<'npmValidatedWebhookEvent', NpmWebhookEvent> &
  Record<'telegram', TelegramClient>

/**
 * Handles a npm hook.
 *
 * - https://blog.npmjs.org/post/145260155635/introducing-hooks-get-notifications-of-npm
 * - https://github.com/npm/npm-hook-receiver/blob/master/index.js
 * - https://github.com/npm/npm-hook-slack/blob/master/index.js
 */
export const onRequestPost: PagesFunction<Env, any, Data> = async (ctx) => {
  const webhook_event = ctx.data.npmValidatedWebhookEvent
  const verified_info = `<i>the event was verified by the npmjs.com webhooks middleware</i>`
  const telegram = ctx.data.telegram

  const { event, name, type, version, hookOwner } = webhook_event
  const username = hookOwner.username
  const distTags = webhook_event.payload['dist-tags']
  const { author, description, keywords } = webhook_event.payload

  const obj = {
    event,
    name,
    type,
    version,
    username,
    distTags,
    description,
    author,
    keywords,
    headers: ctx.request.headers
  }

  const host = ctx.request.headers.get('host')

  let text = ''
  switch (webhook_event.event) {
    case 'package:change': {
      text = text.concat(
        `<b>${Emoji.Package} npm package <code>${webhook_event.name}</code> changed</b>`
      )

      text = text.concat('\n\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(obj, null, 2)}</code></pre>`
      )
      break
    }
    default: {
      text = text.concat(
        `<b>${Emoji.Warning} received a webhook event not handled by this app</b>`
      )

      text = text.concat('\n\n')
      text = text.concat(
        `<pre><code>${JSON.stringify(obj, null, 2)}</code></pre>`
      )
    }
  }

  text = text.concat('\n\n')
  text = text.concat(
    `${Emoji.Hook} <i>event handled by ${host}</i> - ${verified_info}`
  )

  const { failures, successes, warnings } = await telegram.sendMessage(text)

  let data: object
  if (failures.length === 0) {
    data = {
      message: `npm webhook processed successfully`,
      successes,
      warnings
    }
  } else {
    data = {
      message: `failed to process npm webhook`,
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
