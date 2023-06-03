import type { Context, Env, Input } from 'hono'
import { head, body } from './_html.js'

// TODO: make this a default, but make it configurable in the middleware config
export const badRequest = <
  E extends Env = Env,
  P extends string = any,
  I extends Input = {}
>(
  ctx: Context<E, P, I>
) => {
  const message = 'Bad Request'
  const content_type = ctx.req.headers.get('content-type')

  if (content_type === 'application/json') {
    return ctx.json({ message }, { status: 400 })
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

// TODO: make this a default, but make it configurable in the middleware config
export const serviceUnavailable = <
  E extends Env = Env,
  P extends string = any,
  I extends Input = {}
>(
  ctx: Context<E, P, I>
) => {
  const message = 'Service unavailable'
  const content_type = ctx.req.headers.get('content-type')

  if (content_type === 'application/json') {
    return ctx.json({ message }, { status: 503 })
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
