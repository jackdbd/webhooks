import { operationListText } from "@jackdbd/telegram-text-messages/operation-list";
import type { Env } from "../_environment.js";
import type { Client } from "../_telegram-plugin.js";
import { head, body } from "../_html.js";
import { Emoji } from "../_utils.js";
import { testerIps } from "./_utils.js";

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const title = `WebPageTest pingback`;

  const { searchParams } = new URL(ctx.request.url);
  const test_id = searchParams.get("id");

  const ips = await testerIps();
  const testers = `<ol>${ips
    .map((ip) => `<li><code>${ip}</code></li>`)
    .join("")}</ol>`;

  const instructions = `
  <p>WebPageTest pingbacks look like this:<p>
  <pre><code>https://www.webpagetest.org/result/WEBPAGETEST-TEST-ID</code></pre>
  <p>You can use send WebPageTest pingbacks to this URL.<p>
  <p>See the <a href="https://product.webpagetest.org/api" rel="noopener noreferrer" target="_blank">WebPageTest API</a><p>
  <p>IP addresses of WebPageTest testers: ${testers}<p>`;

  if (!test_id) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
      ${head()}
      ${body({ title, instructions })}
    </html>`;
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  }

  const test_result_url = `https://www.webpagetest.org/result/${test_id}/`;

  const telegram = ctx.data.telegram as Client;

  const successes: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  const text = operationListText({
    app_name: `${Emoji.Hook} ${Emoji.Inspect} webhooks`,
    app_version: "0.0.1",
    description: `This pingback was sent from WebPageTest. The web performance test <a href="${test_result_url}" target="_blank">${test_id}</a> is now ready.`,
    operations: [
      {
        successes,
        failures,
        warnings,
        title: `WebPageTest pingback`,
      },
    ],
  });

  const data = await telegram.sendMessage(text);

  const html = `
      <!DOCTYPE html>
      <html lang="en">
        ${head()}
        ${body({
          title,
          successes: data.successes,
          failures: data.failures,
          warnings: data.warnings,
        })}
      </html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
  });
};
