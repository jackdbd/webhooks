import { z } from 'zod'
import { NAME } from './_constants.js'

export const post_request_body_schema = z.object({})

export const env_var_holding_secret = 'WEBHOOK_SECRET'

export const request_context_key = `${NAME}-debug-key`
