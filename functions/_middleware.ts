// https://developers.cloudflare.com/pages/platform/functions/middleware/
import type { EventContext } from "@cloudflare/workers-types";

export interface Env {
  TELEGRAM: string;
}

export type ChatId = string | number;

export interface TelegramCredentials {
  chat_id: ChatId;
  token: string;
}

export interface Telegram {
  sendMessage: (text: string) => Promise<{
    successes: string[];
    failures: string[];
    warnings: string[];
  }>;
}

export interface Data {
  telegram: Telegram;
}

// import this in your request handlers
export type AppEventContext = EventContext<Env, any, Data>;

const makeSendTelegramMessage = (creds: TelegramCredentials) => {
  const { chat_id, token } = creds;

  return async function sendTelegramMessage(text: string) {
    const successes: string[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];

    const body = {
      chat_id,
      disable_notification: false,
      disable_web_page_preview: true,
      parse_mode: "HTML",
      text,
    };

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-type": `application/json`,
          },
        }
      );

      const { ok, result }: any = await res.json();

      const delivered = ok ? true : false;
      const delivered_at = new Date(result.date * 1000).toISOString();
      const message = `message id ${result.message_id} delivered to chat id ${result.chat.id} (username ${result.chat.username}) by bot ${result.from.first_name}`;

      if (delivered) {
        console.log({
          message,
          delivered,
          delivered_at,
        });
        successes.push(message);
      } else {
        console.log({ message });
        warnings.push(message);
      }
    } catch (err: any) {
      const message = `could not send Telegram message`;
      console.log({ message, original_error_message: err.message });
      failures.push(message);
    }

    return {
      failures,
      successes,
      warnings,
    };
  };
};

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
  const { chat_id, token } = JSON.parse(
    ctx.env.TELEGRAM
  ) as TelegramCredentials;

  // use the data object to pass data to other middlewares
  ctx.data.telegram = {
    sendMessage: makeSendTelegramMessage({ chat_id, token }),
  };

  return ctx.next();
}

export const onRequest = [telegram];
