import { Component, type ReactNode, type ErrorInfo } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-[16px] bg-danger-50 text-danger-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-lg font-bold text-heading mb-2">Something went wrong</h1>
            <p className="text-sm text-muted mb-6">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-[12px] hover:bg-primary-700 transition-all"
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
