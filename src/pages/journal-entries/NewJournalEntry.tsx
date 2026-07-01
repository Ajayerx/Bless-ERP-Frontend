"use client"
import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Link } from "@/components/ui"
import { journalEntryService, type JournalEntryFormData } from "@/services/journal_entries.service"
import JournalEntryForm, { type JournalEntryFormRef } from "@/modules/journal_entries/JournalEntryForm"

export default function NewJournalEntry() {
  const navigate = useNavigate()
  const formRef = useRef<JournalEntryFormRef>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data: JournalEntryFormData) => {
    setLoading(true)
    try {
      const res = await journalEntryService.create(data)
      navigate(`/journal-entries/${res.id}`)
    } finally { setLoading(false) }
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/journal-entries" className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back to Journal Entries
          </Link>
          <Button onClick={() => formRef.current?.submit()} loading={loading}><Save size={14} /> Save Entry</Button>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">New Journal Entry</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <JournalEntryForm ref={formRef} onSubmit={onSubmit} />
        </div>
      </motion.div>
    </>
  )
}
