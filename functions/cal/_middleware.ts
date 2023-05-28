import calComPlugin from '@jackdbd/cloudflare-pages-plugin-cal-com'

export const onRequestPost = [calComPlugin({ shouldValidate: true })]
