import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { handle } from "hono/cloudflare-pages";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import type { AppEventContext } from "../_middleware.js";

const app = new Hono();

// https://github.com/honojs/hono/tree/main/src/middleware
app.use("*", logger());
app.use("*", prettyJSON());

app.notFound((ctx) => ctx.json({ message: "Not Found", ok: false }, 404));

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

// https://docs.npmjs.com/cli/v9/commands/npm-hook

app.post("/", zValidator("json", schema), async (ctx) => {
  const payload = ctx.req.valid("json");

  const host = ctx.req.headers.get("host");
  const user_agent = ctx.req.headers.get("user-agent");
  const real_ip = ctx.req.headers.get("x-real-ip");
  const forwarded_for = ctx.req.headers.get("x-forwarded-for");
  console.log({ host, user_agent, real_ip, forwarded_for });

  if (!ctx.env) {
    throw new Error(`ctx.env is not defined`);
  }

  const telegram = (ctx.env.eventContext as AppEventContext).data.telegram;

  // console.log(`[${ctx.req.method}] ${ctx.req.url}`);
  // const payload = await ctx.req.json<NpmEvent>();

  const { event, name, type, version, hookOwner } = payload;
  const username = hookOwner.username;
  const distTags = payload.payload["dist-tags"];
  const { author, description, keywords } = payload.payload;

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
    headers: ctx.req.headers,
  };

  console.log(`received webhook event ${event}`);

  // https://blog.npmjs.org/post/145260155635/introducing-hooks-get-notifications-of-npm
  // https://github.com/npm/npm-hook-receiver/blob/master/index.js
  // https://github.com/npm/npm-hook-slack/blob/master/index.js

  const signature = ctx.req.headers.get("x-npm-signature");
  // TODO: check that this header is correct. Otherwise return a HTTP 400.
  console.log(`npm hook signature is ${signature}`);

  let text = `<b>🪝 webhook event from npm.js (${host})</b>`;
  text = text.concat("\n\n");
  text = text.concat(`<pre><code>${JSON.stringify(obj, null, 2)}</code></pre>`);

  const { failures, successes, warnings } = await telegram.sendMessage(text);

  if (failures.length === 0) {
    return ctx.json({
      message: `npm webhook processed successfully`,
      successes,
      warnings,
    });
  } else {
    return ctx.json({
      message: `failed to process npm webhook`,
      failures,
      warnings,
    });
  }
});

export const onRequest = handle(app, "/npm");
