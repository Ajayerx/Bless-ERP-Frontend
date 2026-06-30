import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider } from "./components/ui/toast"
import App from "./App"
import "./index.css"

async function startMsw() {
  const { worker } = await import("./mocks/browser")
  await worker.start({ onUnhandledRequest: "bypass" })

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      worker.start({ onUnhandledRequest: "bypass" }).catch(() => {})
    }
  })

  window.addEventListener("online", () => {
    worker.start({ onUnhandledRequest: "bypass" }).catch(() => {})
  })
}

async function bootstrap() {
  if (import.meta.env.DEV) {
    try {
      await startMsw()
    } catch {
      setTimeout(startMsw, 1000)
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>
  )
}

bootstrap()
