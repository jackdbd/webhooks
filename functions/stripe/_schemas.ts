import { z } from 'zod'

export const post_request_body = z.object({
  id: z.string().min(1),
  object: z.enum(['event']),
  api_version: z.string().min(1),
  created: z.number(),
  data: z.object({
    object: z.object({
      id: z.string().min(1),
      object: z.string().min(1)
    })
  }),
  livemode: z.boolean(),
  pending_webhooks: z.number(),
  request: z.object({
    id: z.string().min(1),
    idempotency_key: z.string().min(1)
  }),
  type: z.string().min(1)
})

export type StripeWebhookEvent = z.infer<typeof post_request_body>
