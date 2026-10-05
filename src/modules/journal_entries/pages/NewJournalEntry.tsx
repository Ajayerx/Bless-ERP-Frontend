"use client"
import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save, Send } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Link } from "@/components/ui"
import JournalEntryForm, { type JournalEntryFormHandle } from "../components/JournalEntryForm"

export default function NewJournalEntry() {
  const navigate = useNavigate()
  const formRef = useRef<JournalEntryFormHandle>(null)
  const [loading, setLoading] = useState<"Save" | "Submit" | null>(null)
  const [error, setError] = useState("")

  const run = async (action: "Save" | "Submit") => {
    setError("")
    setLoading(action)
    try {
      const name = await formRef.current?.save(action)
      if (name) navigate(`/journal-entries/${encodeURIComponent(name)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save journal entry.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/journal-entries" className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back to Journal Entries
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => run("Save")} loading={loading === "Save"}>
              <Save size={14} /> Save
            </Button>
            <Button onClick={() => run("Submit")} loading={loading === "Submit"}>
              <Send size={14} /> Save & Submit
            </Button>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">New Journal Entry</h1>
        {error && (
          <div className="mb-4 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            {error}
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-card p-6">
          <JournalEntryForm ref={formRef} mode="create" />
        </div>
      </motion.div>
    </>
  )
}