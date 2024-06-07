import { z } from 'zod'

export const attendee = z.object({
  email: z.string().email(),
  language: z.object({
    locale: z.string()
  }),
  name: z.string(),
  timeZone: z.string()
})

export const payload = z.object({
  additionalNotes: z.string().optional(),
  appsStatus: z.any(),
  attendees: z.array(attendee),
  bookingId: z.number().optional(),
  cancellationReason: z.string().optional(),
  currency: z.string(),
  customInputs: z.any(),
  description: z.string(),
  destinationCalendar: z.any(),
  endTime: z.string().min(1),
  eventDescription: z.string(),
  eventTitle: z.string(),
  eventTypeId: z.number().optional(),
  hideCalendarNotes: z.boolean().optional(),
  length: z.number(),
  location: z.string(),
  metadata: z.any(),
  organizer: z.any(),
  price: z.number().nullable(),
  rescheduleUid: z.string().min(1).optional(),
  requiresConfirmation: z.any(),
  responses: z.any(),
  seatsPerTimeSlot: z.any(),
  seatsShowAttendees: z.boolean().nullable(),
  startTime: z.string().min(1),
  status: z.enum(['ACCEPTED', 'CANCELLED']),
  title: z.string(),
  type: z.string().min(1),
  uid: z.string().min(1),
  userFieldsResponses: z.any()
})

/**
 * Webhook event sent by cal.com.
 *
 * https://cal.com/docs/core-features/webhooks#an-example-webhook-payload
 */
export const post_request_body = z.object({
  triggerEvent: z.enum([
    'BOOKING_CREATED',
    'BOOKING_CANCELLED',
    'BOOKING_RESCHEDULED',
    'MEETING_ENDED',
    'RECORDING_DOWNLOAD_LINK_READY'
  ]),
  // https://zod.dev/?id=iso-datetimes
  createdAt: z.string().datetime().min(1),
  payload
})

export type CalWebhookEvent = z.infer<typeof post_request_body>
