import { z } from 'zod'

export const post_request_body = z.object({
  /**
   * A Cloud Monitoring incident contains many more fields, but I only care
   * about these ones for now.
   */
  incident: z.object({
    condition_name: z.string().min(1),
    policy_name: z.string().min(1),
    summary: z.string().min(1),
    url: z.string().min(1)
  }),
  version: z.string().min(1)
})

export type MonitoringWebhookEvent = z.infer<typeof post_request_body>
