import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import App from "./App"
import "./index.css"

async function bootstrap() {
  if (import.meta.env.DEV) {
    const { worker } = await import("./mocks/browser")
    await worker.start({ onUnhandledRequest: "bypass" })
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  )
}

bootstrap()
