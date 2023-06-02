import type { MiddlewareHandler } from 'hono'
import { ZodObject } from 'zod'
import {
  badRequest,
  defaultOrOptional,
  makeVerifyWebhook,
  PREFIX,
  serviceUnavailable
} from './_utils.js'
import type { AuditEntry, DefaultWebhook, Environment } from './_utils.js'

export interface Options<T extends DefaultWebhook = DefaultWebhook> {
  env_var?: string
  header?: string
  schema?: ZodObject<T>
}

export const DEFAULT: Options = { env_var: 'WEBHOOK_SECRET' }

const logAuditTrail = (audit_trail: AuditEntry[]) => {
  console.log(`${PREFIX} audit trail`)
  audit_trail.forEach((d) => {
    console.log(d)
  })
}

export const webhooksMiddleware = <E extends Environment = Environment>(
  options: Options = {}
): MiddlewareHandler<E> => {
  const header = defaultOrOptional(DEFAULT.header, options.header)
  if (!header) {
    throw new Error(`${PREFIX} header not set`)
  }

  const env_var = defaultOrOptional(DEFAULT.env_var, options.env_var)
  if (!env_var) {
    throw new Error(`${PREFIX} env_var not set`)
  }

  const schema = defaultOrOptional(DEFAULT.schema, options.schema)

  return async (ctx, next) => {
    if (ctx.req.method !== 'POST') {
      return await next()
    }

    const audit_trail: AuditEntry[] = []

    const cf_ray = ctx.req.headers.get('CF-Ray')
    if (!cf_ray) {
      audit_trail.push({
        cf_ray: 'not-set',
        message: `got a request context that has no CF-Ray header`,
        timestamp: new Date().getTime()
      })
      logAuditTrail(audit_trail)
      return serviceUnavailable(ctx)
    }

    if (!ctx.env) {
      audit_trail.push({
        cf_ray,
        message: `got a request context that has no env`,
        timestamp: new Date().getTime()
      })
      logAuditTrail(audit_trail)
      return serviceUnavailable(ctx)
    }

    const secret = ctx.env[env_var] // as string | undefined
    if (!secret) {
      audit_trail.push({
        cf_ray,
        message: `environment variable ${env_var} not set`,
        timestamp: new Date().getTime()
      })
      logAuditTrail(audit_trail)
      return serviceUnavailable(ctx)
    }

    const verifyWebhook = makeVerifyWebhook({ env_var, header, secret, schema })

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
