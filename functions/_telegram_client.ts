export type ChatId = string | number;

export interface Credentials {
  chat_id: ChatId;
  token: string;
}

export type SendMessage = (text: string) => Promise<{
  successes: string[];
  failures: string[];
  warnings: string[];
}>;

export interface Client {
  sendMessage: SendMessage;
}

export const makeSendTelegramMessage = (creds: Credentials) => {
  const { chat_id, token } = creds;

  // make these options of sendTelegramMessage
  const options = {
    disable_notification: false,
    disable_web_page_preview: true,
    parse_mode: "HTML",
  };

  return async function sendTelegramMessage(text: string) {
    const successes: string[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];

    const body = {
      chat_id,
      disable_notification: options.disable_notification,
      disable_web_page_preview: options.disable_web_page_preview,
      parse_mode: options.parse_mode,
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

      const outcome: any = await res.json();
      const { ok, result, error_code, description }: any = outcome;

      const delivered = ok ? true : false;

      let message: string;
      if (result) {
        message = `message id ${result.message_id} delivered to chat id ${result.chat.id} (username ${result.chat.username}) by bot ${result.from.first_name}`;
      } else {
        message = `Telegram error code ${error_code}: ${description}`;
      }

      if (delivered) {
        const delivered_at = new Date(result.date * 1000).toISOString();
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
