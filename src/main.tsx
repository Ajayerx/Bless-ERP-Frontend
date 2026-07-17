import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { AppProvider } from "./context/AppContext"
import { ThemeProvider } from "./context/ThemeContext"
import { CompanyProvider } from "./context/CompanyContext"
import { ToastProvider } from "./components/ui/toast"
import ErrorBoundary from "./components/ErrorBoundary"
import App from "./App"
import "./index.css"

async function startMsw() {
  try {
    const { worker } = await import("./mocks/browser")
    await worker.start({ onUnhandledRequest: "bypass" })
  } catch (err) {
    console.error("[MSW] Failed to start mock service worker:", err)
  }
}

async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MSW === "true") {
    await startMsw()
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <CompanyProvider>
                  <AppProvider>
                    <App />
                  </AppProvider>
                </CompanyProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  )
}

bootstrap()
