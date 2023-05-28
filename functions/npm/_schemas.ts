import { z } from 'zod'

/**
 * Webhook event sent by npmjs.com.
 *
 * @see https://docs.npmjs.com/cli/v9/commands/npm-hook
 */
export const post_request_body = z.object({
  event: z.enum(['package:change']),
  name: z.string().nonempty(),
  type: z.enum(['package']),
  version: z.string().nonempty(),
  hookOwner: z.object({
    username: z.string().nonempty()
  }),
  payload: z.object({
    author: z.any(),
    description: z.string(),
    'dist-tags': z.any(),
    keywords: z.array(z.string())
  }),
  change: z.any(),
  time: z.number()
})

export type NpmWebhookEvent = z.infer<typeof post_request_body>
