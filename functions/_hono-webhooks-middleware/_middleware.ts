import type { Env, MiddlewareHandler } from 'hono'
// import { type EventContext } from 'hono/cloudflare-pages'
import { ZodObject } from 'zod'
import {
  type AuditEntry,
  badRequest,
  default_schema,
  defaultOrOptional,
  type DefaultWebhook,
  makeVerifyWebhook,
  PREFIX,
  serviceUnavailable
} from './_utils.js'

export interface Config<T extends DefaultWebhook = DefaultWebhook> {
  env_var: string
  header: string
  schema?: ZodObject<T>
  verification_message_var: string
}

export const DEFAULT: Partial<Config> = {
  schema: default_schema
}

// TODO: make this a configurable sink
const logAuditTrail = (audit_trail: AuditEntry[]) => {
  console.log(`${PREFIX} audit trail`)
  audit_trail.forEach((d) => {
    console.log(d)
  })
}

export const webhooksMiddleware = <E extends Env = Env>(
  config: Config
): MiddlewareHandler<E> => {
  if (!config) {
    throw new Error(`${PREFIX} config not set`)
  }

  if (!config.header) {
    throw new Error(`${PREFIX} header not set`)
  }
  const header = config.header

  if (!config.env_var) {
    throw new Error(`${PREFIX} env_var not set`)
  }
  const env_var = config.env_var

  const schema = defaultOrOptional(DEFAULT.schema, config.schema)
  if (!schema) {
    throw new Error(`${PREFIX} schema not set`)
  }

  if (!config.verification_message_var) {
    throw new Error(`${PREFIX} verification_message_var not set`)
  }
  const verification_message_var = config.verification_message_var

  return async (ctx, next) => {
    if (ctx.req.method !== 'POST') {
      return await next()
    }

    const audit_trail: AuditEntry[] = []

    const cf_ray = ctx.req.headers.get('CF-Ray')
    if (!cf_ray) {
      audit_trail.push({
        cf_ray: 'not-set',
        message: `request has no CF-Ray header`,
        timestamp: new Date().getTime()
      })
      logAuditTrail(audit_trail)
      return serviceUnavailable(ctx)
    }

    if (!ctx.env) {
      audit_trail.push({
        cf_ray,
        message: `request has no environment variables available in its context`,
        timestamp: new Date().getTime()
      })
      logAuditTrail(audit_trail)
      return serviceUnavailable(ctx)
    }

    // const ec = ctx.env.eventContext as EventContext<E>
    // const functionPath = ec.functionPath
    // console.log(
    //   `ctx.env.eventContext.functionPath`,
    //   functionPath,
    //   `ctx.req.path`,
    //   ctx.req.path
    // )

    const secret = ctx.env[env_var] as string | undefined
    if (!secret) {
      audit_trail.push({
        cf_ray,
        message: `environment variable ${env_var} not available in this request context`,
        timestamp: new Date().getTime()
      })
      logAuditTrail(audit_trail)
      return serviceUnavailable(ctx)
    }

    const verifyWebhook = makeVerifyWebhook<E>({
      header,
      secret,
      schema,
      verification_message_var
    })

    const { audit_trail: audits, error, is_server } = await verifyWebhook(ctx)

    audits.forEach((d) => audit_trail.push(d))

    if (error) {
      if (is_server) {
        logAuditTrail(audit_trail)
        return serviceUnavailable(ctx)
      } else {
        logAuditTrail(audit_trail)
        return badRequest(ctx)
      }
    }

    logAuditTrail(audit_trail)
    return await next()
  }
}
