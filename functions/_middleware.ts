import telegramPlugin from '@jackdbd/cloudflare-pages-plugin-telegram'

export const onRequest = [
  telegramPlugin({
    disable_notification: false,
    disable_web_page_preview: true
  })
]
