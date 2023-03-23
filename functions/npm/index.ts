import { z } from "zod";
import type { Client } from "../_telegram_client.js";
import { Emoji } from "../_utils.js";

interface Env {
  STRIPE_API_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TELEGRAM_CHAT_ID?: string;
}

export const onRequest: PagesFunction<Env> = (ctx) => {
  const css = `
  .inline-code {
    background-color:lightgray;
    display: inline;
    font-family: monospace;
    padding: 0.15em;
  }
  `;

  const title = `How to list your npm hooks`;

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/water.css">
    <style>${css}</style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>You can use this command to list all of your npm hooks:<p>
    <pre><code>npm hook ls</code></pre>
    <p>See the <a href="https://docs.npmjs.com/cli/v9/commands/npm-hook" rel="noopener noreferrer" target="_blank">documentation on npm.js</a><p>
    <p>Back to <a href="/">home</a>.<p>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
  });
};

const schema = z.object({
  event: z.enum(["package:change"]),
  name: z.string().nonempty(),
  type: z.enum(["package"]),
  version: z.string().nonempty(),
  hookOwner: z.object({
    username: z.string().nonempty(),
  }),
  payload: z.object({
    author: z.any(),
    description: z.string(),
    "dist-tags": z.any(),
    keywords: z.array(z.string()),
  }),
  change: z.any(),
  time: z.number(),
});

type NpmWebhookEvent = z.infer<typeof schema>;

// TODO: I could develop a Cloudflare Pages plugin to validate the webhook event
// fired by npm.js and make the validated event available in `context.data`

/**
 * Handles a npm hook.
 *
 * - https://blog.npmjs.org/post/145260155635/introducing-hooks-get-notifications-of-npm
 * - https://github.com/npm/npm-hook-receiver/blob/master/index.js
 * - https://github.com/npm/npm-hook-slack/blob/master/index.js
 */
export const onRequestPost: PagesFunction<
  Env,
  any,
  Record<"telegram", Client>
> = async (ctx) => {
  const body = await ctx.request.json();

  const result = schema.safeParse(body);

  if (!result.success) {
    const err = result.error;
    console.log({
      message: `Zod validation error`,
      errors: err.errors,
      issues: err.issues,
    });
    const data = { message: `Bad Request: invalid npm webhook event` };
    return new Response(JSON.stringify(data, null, 2), {
      status: 400,
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    });
  }

  const validated = body as NpmWebhookEvent;
  // const validated = result.data; // stripped of those keys not declared in the schema
  const { event, name, type, version, hookOwner } = validated;

  const username = hookOwner.username;
  const distTags = validated.payload["dist-tags"];
  const { author, description, keywords } = validated.payload;

  const obj = {
    event,
    name,
    type,
    version,
    username,
    distTags,
    description,
    author,
    keywords,
    headers: ctx.request.headers,
  };

  const host = ctx.request.headers.get("host") || undefined;

  const signature = ctx.request.headers.get("x-npm-signature") || undefined;
  // TODO: check that this header is correct. Otherwise return a HTTP 400.
  // TODO: use zod to validate x-npm-signature
  console.log(`npm hook signature is ${signature}`);

  let text = `<b>${Emoji.Hook} npm.js hook (${host})</b>`;
  text = text.concat("\n\n");
  text = text.concat(`<pre><code>${JSON.stringify(obj, null, 2)}</code></pre>`);

  const telegram = ctx.data.telegram;
  const { failures, successes, warnings } = await telegram.sendMessage(text);

  let data: object;
  if (failures.length === 0) {
    data = {
      message: `npm webhook processed successfully`,
      successes,
      warnings,
    };
  } else {
    data = {
      message: `failed to process npm webhook`,
      failures,
      warnings,
    };
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
  });
};
