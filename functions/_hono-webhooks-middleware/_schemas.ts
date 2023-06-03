import { z } from 'zod'
import { NAME } from './_constants.js'
import {
  env_var_holding_secret,
  post_request_body_schema,
  request_context_key
} from './_defaults.js'

const beforeErrorResponseFunction = z
  .function()
  .args(z.any())
  .returns(z.promise(z.void()))

const errorResponseFunction = z.function().args(z.any()).returns(z.any())

export const config = z
  .object({
    beforeClientErrorResponse: beforeErrorResponseFunction
      .optional()
      .describe(
        'function that this middleware will invoke immediately before returning a response to the client, in case of a CLIENT error'
      ),

    beforeServerErrorResponse: beforeErrorResponseFunction
      .optional()
      .describe(
        'function that this middleware will invoke immediately before returning a response to the client, in case of a SERVER error'
      ),

    clientErrorResponse: errorResponseFunction
      .optional()
      .describe(
        'function that this middleware will invoke to return a response to the client, in case of a CLIENT error'
      ),

    debug_key: z
      .string()
      .nonempty()
      .default(request_context_key)
      .describe(
        'key that this middleware will set in the request context. Useful for troubleshooting your webhooks and understand how this middleware works. You can retrieve the value stored using ctx.get()'
      ),

    header: z
      .string()
      .nonempty()
      .describe('HTTP request header containing the signature to verify'),

    schema: z
      .any()
      .default(post_request_body_schema)
      .describe(
        'Zod schema of the webhook event you expect to receive from the 3rd party service'
      ),

    secret: z
      .string()
      .default(env_var_holding_secret)
      .describe(
        'environment variable whose value is the shared secret the 3rd party service used to sign the request, and that this middleware will use to verify the signature'
      ),

    serverErrorResponse: errorResponseFunction
      .optional()
      .describe(
        'function that this middleware will invoke to return a response to the client, in case of a SERVER error'
      )
  })
  .describe(`Configuration for ${NAME}`)

export type Config = z.infer<typeof config>
