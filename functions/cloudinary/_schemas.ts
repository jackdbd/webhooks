import { z } from 'zod'

/**
 * Webhook event sent by Cloudinary.
 */
export const post_request_body = z
  .object({
    asset_id: z.string(),
    // "asset_id": "ede59e6d3befdc65a8adc2f381c0f96f",

    notification_type: z.string(),
    // "notification_type": "upload",

    request_id: z.string(),
    // "request_id": "71763d4cacf19521f5691a02c8b143b1",

    timestamp: z.string()
    // "timestamp": "2022-11-17T09:07:51+00:00",

    // etc...
    // https://cloudinary.com/documentation/notifications
  })
  .describe('Cloudinary webhook event')

export type WebhookEvent = z.infer<typeof post_request_body>
