import type {
  EventContext,
  PagesPluginFunction,
} from "@cloudflare/workers-types";
import { ChatId, makeSendTelegramMessage } from "./_telegram-client.js";
import type { Credentials, Client } from "./_telegram-client.js";
export type { Client } from "./_telegram-client.js";

/**
 * Environment variables used by this Cloudflare Pages Functions plugin.
 */
export interface TelegramPluginEnv {
  TELEGRAM?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_TOKEN?: string;
}

/**
 * Data that this plugin will add to each fetch request.
 *
 * - If you use "vanilla" Cloudflare Pages Function, access the data at `ctx.data.telegram`
 * - If you use a web framework like Hono, access the data at `ctx.env.eventContext.data.telegram`
 */
export interface Data {
  telegram: Client;
}

/**
 * Configuration object for the Telegram plugin.
 */
export interface PluginArgs {
  chat_id?: ChatId;
  token?: string;
  disable_notification?: boolean;
  disable_web_page_preview?: boolean;
}

export type PluginData = { telegram: Client };

const defaults = {
  disable_notification: false,
  disable_web_page_preview: true,
};

export type TelegramPagesPluginFunction<
  Env extends TelegramPluginEnv = TelegramPluginEnv,
  Params extends string = any,
  Data extends Record<string, unknown> = Record<string, unknown>
> = PagesPluginFunction<Env, Params, Data & PluginData, PluginArgs>;

const defaultOrProvided = (default_value: boolean, b?: boolean) => {
  if (b === true || b === false) {
    return b!;
  } else {
    return default_value;
  }
};

let telegram: Client | undefined = undefined;

export const telegramPlugin = <E extends TelegramPluginEnv = TelegramPluginEnv>(
  pluginArgs?: PluginArgs
) => {
  // TODO: decide precedence: args vs TELEGRAM environment variable
  let chat_id = pluginArgs ? pluginArgs.chat_id : undefined;
  let token = pluginArgs ? pluginArgs.token : undefined;

  return function telegramPluginInner(
    ctx: EventContext<E, any, Record<string, Client>>
  ) {
    if (telegram) {
      ctx.data.telegram = telegram;
      return ctx.next();
    }

    console.log("initialize Telegram client");
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

    // store the Telegram client in a global variable, so we don't reinitialize
    // it on every request
    telegram = {
      sendMessage: makeSendTelegramMessage({
        chat_id,
        token,
        disable_notification: defaultOrProvided(
          defaults.disable_notification,
          pluginArgs && pluginArgs.disable_notification
        ),
        disable_web_page_preview: defaultOrProvided(
          defaults.disable_web_page_preview,
          pluginArgs && pluginArgs.disable_web_page_preview
        ),
      }),
    };

    // make the telegram client available to middlewares and handlers
    ctx.data.telegram = telegram;

    return ctx.next();
  };
};
