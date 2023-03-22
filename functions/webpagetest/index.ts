import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";

const app = new Hono();

app.get("/", (ctx) => {
  return ctx.json({
    message: "Hello WPT GET",
  });
});

app.post("/", (ctx) => {
  return ctx.json({
    message: "Hello WPT POST",
  });
});

export const onRequest = handle(app, "/webpagetest");
