import { z } from 'zod'

export const post_request_body = z.object({
  /**
   * A Cloud Monitoring incident contains many more fields, but I only care
   * about these ones for now.
   */
  incident: z.object({
    condition_name: z.string().nonempty(),
    policy_name: z.string().nonempty(),
    summary: z.string().nonempty(),
    url: z.string().nonempty()
  }),
  version: z.string().nonempty()
})

export type MonitoringWebhookEvent = z.infer<typeof post_request_body>
