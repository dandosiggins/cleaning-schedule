import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const getPort = (command: string) => {
  const rawPort = process.env.PORT;

  if (!rawPort) {
    if (command === "serve") {
      throw new Error(
        "PORT environment variable is required but was not provided.",
      );
    }

    return undefined;
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
};

const cartographerPlugins =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
    ? [
        await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          }),
        ),
      ]
    : [];

export default defineConfig(({ command }) => {
  const port = getPort(command);
  const basePath = process.env.BASE_PATH ?? "/";
  const apiTarget = process.env.API_TARGET ?? "http://localhost:5000";

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...cartographerPlugins,
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      ...(port === undefined ? {} : { port }),
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
      },
    },
    preview: {
      ...(port === undefined ? {} : { port }),
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
