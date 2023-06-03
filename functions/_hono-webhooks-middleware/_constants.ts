/**
 * @see https://emojipedia.org/
 */
export enum Emoji {
  Error = '🚨',
  Failure = '❌',
  Fire = '🔥',
  Hook = '🪝',
  Success = '✅',
  Warning = '⚠️'
}

export const NAME = 'hono-webhooks-mw'

export const PREFIX = `[${Emoji.Hook} ${NAME}]`
