import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";

const app = new Hono();

app.get("/", (ctx) => {
  return ctx.json({
    message: "Monitoring GET",
  });
});

app.post("/", (ctx) => {
  return ctx.json({
    message: "Monitoring POST",
  });
});

export const onRequest = handle(app, "/monitoring");
