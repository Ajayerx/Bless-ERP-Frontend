import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import { ToastProvider } from "./components/ui/toast"
import ErrorBoundary from "./components/ErrorBoundary"
import App from "./App"
import "./index.css"

async function startMsw() {
  try {
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
  } catch (err) {
    console.error("[MSW] Failed to start mock service worker:", err)
    setTimeout(startMsw, 1000)
  }
}

async function bootstrap() {
  if (import.meta.env.DEV) {
    await startMsw()
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  )
}

bootstrap()
