import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { operationListText } from "@jackdbd/telegram-text-messages";
import { handle } from "hono/cloudflare-pages";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import type { AppEventContext } from "../_middleware.js";
import { Emoji } from "../_utils.js";

const app = new Hono();
app.use("*", logger());
app.use("*", prettyJSON());
app.notFound((ctx) => ctx.json({ message: "Not Found", ok: false }, 404));

const schema = z.object({
  // incident contains many more fields, but I only care about these ones for now
  incident: z.object({
    condition_name: z.string().nonempty(),
    policy_name: z.string().nonempty(),
    summary: z.string().nonempty(),
    url: z.string().nonempty(),
  }),
  version: z.string().nonempty(),
});

app.post("/", zValidator("json", schema), async (ctx) => {
  if (!ctx.env) {
    throw new Error(`ctx.env is not defined`);
  }

  const validated = ctx.req.valid("json");

  const incident_summary = validated.incident.summary;
  const incident_url = validated.incident.url;
  const policy_name = validated.incident.policy_name;
  const condition_name = validated.incident.condition_name;

  const telegram = (ctx.env.eventContext as AppEventContext).data.telegram;

  const successes: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];
  warnings.push(incident_summary);

  const text = operationListText({
    app_name: `${Emoji.Hook} ${Emoji.ChartDecreasing} webhooks`,
    app_version: "0.0.1",
    description: `the alerting policy ${policy_name} was triggered because the condition ${condition_name} failed. See <a href="${incident_url}" target="_blank">incident here</a>.`,
    operations: [
      {
        successes,
        failures,
        warnings,
        title: `Alerting policy: ${policy_name}`,
      },
    ],
  });

  const result = await telegram.sendMessage(text);

  result.failures.forEach((x) => failures.push(x));
  result.successes.forEach((x) => successes.push(x));
  result.warnings.forEach((x) => warnings.push(x));

  if (failures.length === 0) {
    return ctx.json({
      message: `Cloud Monitoring webhook event processed successfully`,
      successes,
      warnings,
    });
  } else {
    return ctx.json({
      message: `failed to process Cloud Monitoring webhook event`,
      failures,
      warnings,
    });
  }
});

// export const onRequest = handle(app, "/monitoring");
export const onRequestPost = handle(app, "/monitoring");
