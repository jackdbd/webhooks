// import type { EventContext } from "@cloudflare/workers-types";
import { telegramPlugin } from "./_telegram-plugin.js";
// import type { Client } from "./_telegram-plugin.js";
// import { Env } from "./_environment.js";

// Either configure the middleware chain this way...
export const onRequest = [telegramPlugin()];

// ...this way...
// export const onRequest = [
//   telegramPlugin({
//     disable_notification: false,
//     disable_web_page_preview: true,
//   }),
// ];

//...or this other way.
// export const onRequest = (
//   ctx: EventContext<Env, any, Record<string, Client>>
// ) => {
//   const fn = telegramPlugin({
//     chat_id: ctx.env.TELEGRAM_CHAT_ID,
//     token: ctx.env.TELEGRAM_TOKEN,
//     disable_notification: false,
//     disable_web_page_preview: true,
//   });
//   return fn(ctx);
// };
