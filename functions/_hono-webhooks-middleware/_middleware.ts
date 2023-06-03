import type { Env, Input, MiddlewareHandler } from 'hono'
import { fromZodError } from 'zod-validation-error'
import { badRequest, serviceUnavailable } from './_responses.js'
import { config as config_schema } from './_schemas.js'
import type { Config } from './_schemas.js'
import { type AuditEntry, makeVerifyWebhook } from './_verify.js'

export interface AuditTrail {
  summary: string
  entries: AuditEntry[]
}

export const webhooksMiddleware = <
  E extends Env = Env,
  P extends string = any,
  I extends Input = {}
>(
  options: Config
): MiddlewareHandler<E, P, I> => {
  const result = config_schema.safeParse(options)

  if (!result.success) {
    const error = fromZodError(result.error)
    const message = config_schema.description
      ? `${config_schema.description} does not conform to the schema: ${error.message}`
      : `invalid configuration: ${error.message}`

    throw new Error(message)
  }

  const config = result.data

  const header = config.header
  const env_var = config.secret
  const debug_key = config.debug_key
  const schema = config.schema

  const clientErrorResponse = config.clientErrorResponse || badRequest
  const serverErrorResponse = config.serverErrorResponse || serviceUnavailable

  const beforeClientErrorResponse = config.beforeClientErrorResponse
  const beforeServerErrorResponse = config.beforeServerErrorResponse

  return async (ctx, next) => {
    if (ctx.req.method !== 'POST') {
      return await next()
    }

    const host = ctx.req.headers.get('host')
    const received_at = host ? `${host}${ctx.req.path}` : ctx.req.path

    const audit_trail: AuditTrail = {
      summary: `webhook verification at ${received_at} failed`,
      entries: []
    }

    // Immediately store the audit_trail object in the request context, so all
    // donwstream middlewares and route handlers will be able to access it, even
    // when there is an error in this middleware.
    // The audit_trail object is MUTATED IN PLACE.
    ctx.set(debug_key as any, audit_trail)

    const cf_ray = ctx.req.headers.get('CF-Ray')
    if (!cf_ray) {
      audit_trail.entries.push({
        cf_ray: 'not-set',
        message: `request has no CF-Ray header`,
        timestamp: new Date().getTime()
      })

      if (beforeServerErrorResponse) {
        await beforeServerErrorResponse(ctx)
      }

      return serverErrorResponse(ctx)
    }

    if (!ctx.env) {
      audit_trail.entries.push({
        cf_ray,
        message: `request has no environment variables available in its context`,
        timestamp: new Date().getTime()
      })

      if (beforeServerErrorResponse) {
        await beforeServerErrorResponse(ctx)
      }

      return serverErrorResponse(ctx)
    }

    // const ec = ctx.env.eventContext as EventContext<E>
    // const functionPath = ec.functionPath

    const secret = ctx.env[env_var] as string | undefined
    if (!secret) {
      audit_trail.entries.push({
        cf_ray,
        message: `environment variable ${env_var} not available in this request context`,
        timestamp: new Date().getTime()
      })

      if (beforeServerErrorResponse) {
        await beforeServerErrorResponse(ctx)
      }

      return serverErrorResponse(ctx)
    }

    const verifyWebhook = makeVerifyWebhook({
      header,
      secret,
      schema
    })

    const { audit_entries, error, is_server } = await verifyWebhook(ctx)
    audit_entries.forEach((d) => audit_trail.entries.push(d))

    if (error) {
      if (is_server) {
        if (beforeServerErrorResponse) {
          await beforeServerErrorResponse(ctx)
        }
        return serverErrorResponse(ctx)
      } else {
        if (beforeClientErrorResponse) {
          await beforeClientErrorResponse(ctx)
        }
        return clientErrorResponse(ctx)
      }
    }

    audit_trail.summary = `webhook verification at ${received_at} succeeded`

    return await next()
  }
}
