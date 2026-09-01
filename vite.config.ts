import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const crossOriginTest = env.VITE_LOCAL_CROSS_ORIGIN_TEST === "true"

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: crossOriginTest
        ? undefined
        : {
            "/api": {
              //target: "https://blesserp.com",
              target: "http://blesserp.local:8000",
              changeOrigin: true,
            },
          },
    },
  }
})