interface Env {
  FOO?: string;
}

type Data = Record<string, string | number | undefined>;

interface PluginArgs {
  foo: string;
  bar: number;
  verbose?: boolean;
}

const logRequestHeaders: PagesPluginFunction<Env, any, Data, PluginArgs> = (
  ctx
) => {
  console.log("=== logRequestHeaders ctx.pluginArgs ===");
  const host = ctx.request.headers.get("host") || undefined;
  const user_agent = ctx.request.headers.get("user-agent") || undefined;
  const x_real_ip = ctx.request.headers.get("x-real-ip") || undefined;
  const x_forwarded_for =
    ctx.request.headers.get("x-forwarded-for") || undefined;

  console.log({ host, user_agent, x_real_ip, x_forwarded_for });

  ctx.data.host = host;
  ctx.data.user_agent = user_agent;

  return ctx.next();
};

export const onRequest = [logRequestHeaders];
