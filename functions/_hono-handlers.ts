import type { ErrorHandler, NotFoundHandler } from 'hono'
import { errorText } from '@jackdbd/telegram-text-messages'
import type { AppEventContext } from './_environment.js'
import { errorPage, notFoundPage } from './_html.js'
import { Emoji } from './_utils.js'

/**
 * https://hono.dev/api/hono#error-handling
 */
export const onError: ErrorHandler = async (err, ctx) => {
  console.error(`${err}`)

  if (ctx.env) {
    const telegram = (ctx.env.eventContext as AppEventContext).data.telegram

    const err_name = err.name || 'Error'
    const error_title = `${err_name} encountered at <code>${ctx.req.method} ${ctx.req.path}</code>`

    try {
      const result = await telegram.sendMessage(
        errorText({
          app_name: `${Emoji.Hook} webhooks`,
          app_version: '0.0.1',
          error_title,
          error_message: err.message || 'no error message',
          links: [
            {
              href: `https://hono.dev/api/hono#error-handling`,
              text: `Hono error handling`
            }
          ]
        })
      )
      console.log({
        ...result,
        message: `Message sent to Telegram chat: ${error_title}`
      })
    } catch (ex: any) {
      console.error({
        error: ex,
        message: `Could not sent message to Telegram chat`
      })
    }
  }

  return ctx.html(errorPage(), 500)
}

/**
 * https://hono.dev/api/hono#not-found
 */
export const notFound: NotFoundHandler = (ctx) => {
  // const message = [
  //   `Test exception`,
  //   `See how the error page renders`,
  //   `Check if the Telegram plugin works`,
  // ].join("\n");
  // throw new Error(message);
  return ctx.html(notFoundPage(ctx.req.path), 404)
}
