import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const PROXY_PREFIX = "/api/opencode";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "opencode-dev-proxy",
      configureServer(server) {
        server.middlewares.use(PROXY_PREFIX, async (req, res) => {
          const targetBaseUrl = req.headers["x-opencode-base-url"];
          const username = req.headers["x-opencode-username"];
          const password = req.headers["x-opencode-password"];

          if (typeof targetBaseUrl !== "string") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing x-opencode-base-url header" }));
            return;
          }

          if (typeof username !== "string" || typeof password !== "string") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing OpenCode credentials headers" }));
            return;
          }

          const pathname = req.url || "/";
          const targetUrl = `${trimTrailingSlash(targetBaseUrl)}${pathname}`;

          try {
            const method = req.method || "GET";
            const wantsEventStream = (req.headers.accept || "").includes("text/event-stream") || pathname.startsWith("/event");
            const bodyBuffer =
              method === "GET" || method === "HEAD"
                ? undefined
                : await new Promise<Buffer>((resolve, reject) => {
                    const chunks: Buffer[] = [];
                    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
                    req.on("end", () => resolve(Buffer.concat(chunks)));
                    req.on("error", reject);
                  });

            const response = await fetch(targetUrl, {
              method,
              headers: {
                Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
                "Content-Type": req.headers["content-type"] || "application/json",
              },
              body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
            });

            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              if (key.toLowerCase() === "content-encoding") return;
              res.setHeader(key, value);
            });

            if (wantsEventStream && response.body) {
              res.setHeader("Cache-Control", "no-cache");
              res.setHeader("Connection", "keep-alive");
              for await (const chunk of response.body) {
                res.write(Buffer.from(chunk));
              }
              res.end();
              return;
            }

            const arrayBuffer = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : "Proxy request failed",
              }),
            );
          }
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
