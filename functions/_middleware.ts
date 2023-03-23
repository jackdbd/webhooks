// https://developers.cloudflare.com/pages/platform/functions/middleware/
import type { EventContext } from "@cloudflare/workers-types";
import { ChatId, makeSendTelegramMessage } from "./_telegram_client.js";
import type { Credentials, Client } from "./_telegram_client.js";

export interface Env {
  TELEGRAM?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_TOKEN?: string;
}

export interface Data {
  telegram: Client;
}

export type AppEventContext = EventContext<Env, any, Data>;

export interface PluginArgs {
  chat_id?: ChatId;
  token?: string;
  disable_notification?: boolean;
  disable_web_page_preview?: boolean;
}

export type PluginData = { telegram: Client };

export type TelegramPagesPluginFunction<
  Env = {
    TELEGRAM?: string;
    TELEGRAM_CHAT_ID?: string;
    TELEGRAM_TOKEN?: string;
  },
  Params extends string = any,
  Data extends Record<string, unknown> = Record<string, unknown>
> = PagesPluginFunction<Env, Params, Data & PluginData, PluginArgs>;

function telegram(ctx: EventContext<Env, any, Data>) {
  if (!ctx.env) {
    throw new Error(`env is not defined in this EventContext`);
  }

  if (!ctx.env.TELEGRAM) {
    const arr = [
      `Environment variable TELEGRAM is not defined in this EventContext.`,
      `Be sure to set it in your .dev.vars file and in your Cloudflare project.`,
    ];
    throw new Error(arr.join(" "));
  }

  const { chat_id, token } = JSON.parse(ctx.env.TELEGRAM) as Credentials;

  // use the data object to pass data to other middlewares
  ctx.data.telegram = {
    sendMessage: makeSendTelegramMessage({ chat_id, token }),
  };

  return ctx.next();
}

// const telegramPlugin = (
//   pluginArgs: PluginArgs,
//   ctx: EventContext<Env, any, Record<string, Client>>
// ) => {
//   // TODO: decide precedence: args vs TELEGRAM environment variable
//   let chat_id = pluginArgs.chat_id;
//   let token = pluginArgs.token;

//   if (ctx.env && ctx.env.TELEGRAM) {
//     const creds = JSON.parse(ctx.env.TELEGRAM) as Credentials;
//     if (creds.chat_id) {
//       chat_id = creds.chat_id;
//     }
//     if (creds.token) {
//       token = creds.token;
//     }
//   }

//   if (!chat_id) {
//     throw new Error(`Telegram chat_id not set`);
//   }

//   if (!token) {
//     throw new Error(`Telegram token not set`);
//   }

//   // make the telegram client available to middlewares and handlers
//   ctx.data.telegram = {
//     sendMessage: makeSendTelegramMessage({
//       chat_id,
//       token,
//     }),
//   };

//   return ctx.next();
// };

const telegramPluginOuter = (pluginArgs: PluginArgs) => {
  // TODO: decide precedence: args vs TELEGRAM environment variable
  let chat_id = pluginArgs.chat_id;
  let token = pluginArgs.token;

  return function inner(ctx: EventContext<Env, any, Record<string, Client>>) {
    if (ctx.env && ctx.env.TELEGRAM) {
      const creds = JSON.parse(ctx.env.TELEGRAM) as Credentials;
      if (creds.chat_id) {
        chat_id = creds.chat_id;
      }
      if (creds.token) {
        token = creds.token;
      }
    }

    if (!chat_id) {
      throw new Error(`Telegram chat_id not set`);
    }

    if (!token) {
      throw new Error(`Telegram token not set`);
    }

    // make the telegram client available to middlewares and handlers
    ctx.data.telegram = {
      sendMessage: makeSendTelegramMessage({
        chat_id,
        token,
      }),
    };

    return ctx.next();
  };
};

// https://github.com/cloudflare/pages-plugins/tree/main/example
// export const onRequest: PagesFunction<{
//   TELEGRAM_CHAT_ID: string;
//   TELEGRAM_TOKEN: string;
// }> = (ctx) => {
//   return telegramPlugin(
//     {
//       chat_id: ctx.env.TELEGRAM_CHAT_ID,
//       token: ctx.env.TELEGRAM_TOKEN,
//       disable_notification: false,
//       disable_web_page_preview: false,
//     },
//     ctx
//   );
// };

// export const onRequest = (
//   ctx: EventContext<Env, any, Record<string, Client>>
// ) => {
//   return telegramPlugin(
//     {
//       chat_id: ctx.env.TELEGRAM_CHAT_ID,
//       token: ctx.env.TELEGRAM_TOKEN,
//       disable_notification: false,
//       disable_web_page_preview: true,
//     },
//     ctx
//   );
// };

// export const onRequest = [telegram];

export const onRequest = (
  ctx: EventContext<Env, any, Record<string, Client>>
) => {
  const fn = telegramPluginOuter({
    chat_id: ctx.env.TELEGRAM_CHAT_ID,
    token: ctx.env.TELEGRAM_TOKEN,
    disable_notification: false,
    disable_web_page_preview: true,
  });
  return fn(ctx);
};
