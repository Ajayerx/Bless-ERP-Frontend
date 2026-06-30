"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/services"
import { LogIn, Building2 } from "lucide-react"

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("alex@blesserp.com")
  const [password, setPassword] = useState("password")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.")
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      navigate("/", { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError("Connection failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-app-bg flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 -right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Building2 size={22} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">BlessERP</span>
          </div>
        </div>
        <div className="relative">
          <blockquote className="text-white/90 text-lg font-medium leading-relaxed">
            "A modern business management platform designed for enterprises that demand clarity, speed, and control."
          </blockquote>
          <p className="text-white/60 text-sm mt-4 font-medium">
            Enterprise Resource Planning, reimagined.
          </p>
        </div>
        <div className="text-white/30 text-xs">
          &copy; 2026 BlessERP. All rights reserved.
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-[14px] bg-primary-600 flex items-center justify-center mx-auto mb-3">
              <Building2 size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-heading">BlessERP</h1>
            <p className="text-sm text-muted mt-1">Sign in to your account</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-heading">Welcome back</h1>
            <p className="text-sm text-muted mt-1">Sign in to your account</p>
          </div>

          {/* Demo hint */}
          <div className="bg-primary-50 border border-primary-100 rounded-[14px] px-4 py-3 mb-6">
            <p className="text-xs text-primary-700 font-semibold">Demo Credentials</p>
            <p className="text-xs text-primary-600/70 mt-0.5">
              alex@blesserp.com / password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-body mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-body mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-2.5 rounded-[10px]"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
