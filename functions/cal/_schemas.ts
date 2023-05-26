import { z } from 'zod'

/**
 * Webhook event sent by cal.com.
 *
 * https://cal.com/docs/core-features/webhooks#an-example-webhook-payload
 */
export const post_request_body = z.object({
  triggerEvent: z.enum([
    'BOOKING_CREATED',
    'BOOKING_CANCELED',
    'BOOKING_RESCHEDULED',
    'MEETING_ENDED',
    'RECORDING_DOWNLOAD_LINK_READY'
  ]),
  // https://zod.dev/?id=iso-datetimes
  createdAt: z.string().datetime().nonempty(),
  payload: z.any()
})

export type CalWebhookEvent = z.infer<typeof post_request_body>
