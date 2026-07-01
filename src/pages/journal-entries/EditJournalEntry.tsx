"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link } from "@/components/ui"
import { journalEntryService, type JournalEntry, type JournalEntryFormData } from "@/services/journal_entries.service"
import JournalEntryForm, { type JournalEntryFormRef } from "@/modules/journal_entries/JournalEntryForm"

export default function EditJournalEntry() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formRef = useRef<JournalEntryFormRef>(null)
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    journalEntryService.getById(id).then(setEntry).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const onSubmit = async (data: JournalEntryFormData) => {
    if (!id) return
    setSaving(true)
    try {
      await journalEntryService.update(id, data)
      navigate(`/journal-entries/${id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!entry) return <><Topbar /><div className="p-6 text-center text-muted">Entry not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to={`/journal-entries/${id}`} className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back
          </Link>
          <Button onClick={() => formRef.current?.submit()} loading={saving}><Save size={14} /> Save Changes</Button>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Journal Entry</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <JournalEntryForm ref={formRef} defaultValues={entry} onSubmit={onSubmit} />
        </div>
      </motion.div>
    </>
  )
}
