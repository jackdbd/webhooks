import { z } from 'zod'

export const post_request_body = z.object({
  id: z.string().nonempty(),
  object: z.enum(['event']),
  api_version: z.string().nonempty(),
  created: z.number(),
  data: z.object({
    object: z.object({
      id: z.string().nonempty(),
      object: z.string().nonempty()
    })
  }),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z.object({
    id: z.string().nonempty(),
    idempotency_key: z.string().nonempty()
  }),
  type: z.string().nonempty()
})

export type StripeWebhookEvent = z.infer<typeof post_request_body>
