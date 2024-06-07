import type { Context, Env } from 'hono'
import { head, body } from './_html.js'

export const badRequest = (
  ctx: Context<Env, any, {}>,
  message: string = 'Bad Request'
) => {
  const content_type = ctx.req.header('content-type')

  if (content_type === 'application/json') {
    return ctx.json({ error: true, message }, { status: 400 })
  } else {
    const instructions = `<p>${message}</p>`

    const html = `
<!DOCTYPE html>
<html lang="en">
  ${head()}
  ${body({ title: 'Bad request', instructions })}
</html>`

    return ctx.html(html)
  }
}

export const serviceUnavailable = (
  ctx: Context<Env, any, {}>,
  message: string = 'Service unavailable'
) => {
  const content_type = ctx.req.header('content-type')

  if (content_type === 'application/json') {
    return ctx.json({ error: true, message }, { status: 503 })
  } else {
    const instructions = `<p>${message}</p>`

    const html = `
<!DOCTYPE html>
<html lang="en">
  ${head()}
  ${body({ title: 'Service unavailable', instructions })}
</html>`

    return ctx.html(html)
  }
}
