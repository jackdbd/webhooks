import { z } from 'zod'

// https://zod.dev/?id=iso-datetimes
const dt_with_offset = z.string().datetime({ offset: true })

export const resource = z.object({
  asset_id: z.string(), // e.g. "06c822e86d81a4263e73735ec8b60c3f"
  public_id: z.string(), // e.g. "csbsy1gedwzdqad42zvy"
  resource_type: z.enum(['image']),
  type: z.enum(['upload']),
  version: z.number().positive() // e.g. 1685822411
})

export const notification_context = z.object({
  triggered_at: dt_with_offset.min(1),

  triggered_by: z.object({
    id: z.string(), // e.g. "86787995117726"
    source: z.enum(['api', 'ui'])
  })
})

/**
 * Webhook event sent by Cloudinary.
 */
export const post_request_body = z
  .object({
    // asset_id: z.string(),
    // "asset_id": "ede59e6d3befdc65a8adc2f381c0f96f",

    created_at: z.string().datetime().optional(),

    notification_type: z.enum(['delete', 'upload']),

    resources: z.array(resource).optional(),

    // request_id: z.string(),
    // "request_id": "71763d4cacf19521f5691a02c8b143b1",

    timestamp: dt_with_offset.optional()
    // "timestamp": "2022-11-17T09:07:51+00:00",

    // etc...
    // https://cloudinary.com/documentation/notifications
  })
  .describe('Cloudinary webhook event')

export type WebhookEvent = z.infer<typeof post_request_body>
