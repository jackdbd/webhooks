import { operationListText } from '@jackdbd/telegram-text-messages/operation-list'
import type { Client as TelegramClient } from '@jackdbd/cloudflare-pages-plugin-telegram'
import type { AppEnvironment } from '../_environment.js'
import { head, body } from '../_html.js'
import { Emoji } from '../_utils.js'
import { testerIps } from './_utils.js'

// The telegramPlugin registered in _middleware.ts adds a `telegram` property to
// the `ctx.data` object.
type Data = Record<'telegram', TelegramClient>

export const onRequestGet: PagesFunction<AppEnvironment, any, Data> = async (
  ctx
) => {
  const title = `WebPageTest pingback`

  const { searchParams } = new URL(ctx.request.url)
  const test_id = searchParams.get('id')

  const host = ctx.request.headers.get('host')

  // const ips = await testerIps()
  // const testers = `<ol>${ips
  //   .map((ip) => `<li><code>${ip}</code></li>`)
  //   .join('')}</ol>`

  const instructions = [
    `<p>WebPageTest pingbacks look like this:</p>`,
    `<pre><code>https://www.webpagetest.org/result/WEBPAGETEST-TEST-ID</code></pre>`,
    `<p>You can use send WebPageTest pingbacks to this URL.</p>`,
    `<p>See the <a href="https://product.webpagetest.org/api" rel="noopener noreferrer" target="_blank">WebPageTest API</a></p>`
    // `<p>IP addresses of WebPageTest testers: ${testers}</p>`
  ].join('')

  if (!test_id) {
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

  const test_result_url = `https://www.webpagetest.org/result/${test_id}/`

  let text = `<b>${Emoji.Timer} WebPageTest pingback</b>`

  text = text.concat('\n\n')
  text = text.concat(`This pingback was sent by WebPageTest.`)
  text = text.concat('\n')
  text = text.concat(
    `Test <a href="${test_result_url}">${test_id}</a> is ready.`
  )

  text = text.concat('\n\n')
  text = text.concat(`${Emoji.Hook} <i>webhook event processed by ${host}</i>`)

  const { telegram } = ctx.data
  const { failures, successes, warnings } = await telegram.sendMessage(text)

  let obj: Object = {}
  if (failures.length === 0) {
    obj = {
      message: `webpagetest.org pingback processed successfully`,
      successes,
      warnings
    }
  } else {
    obj = {
      message: `failed to process webpagetest.org pingback`,
      failures,
      warnings
    }
  }

  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json;charset=UTF-8'
    }
  })
}
