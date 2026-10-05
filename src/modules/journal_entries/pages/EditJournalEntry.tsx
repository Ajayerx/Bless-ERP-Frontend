"use client"
import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save, Send } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link } from "@/components/ui"
import { journalEntryService, type JournalEntryDoc } from "@/services"
import JournalEntryForm, { type JournalEntryFormHandle } from "../components/JournalEntryForm"

export default function EditJournalEntry() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const formRef = useRef<JournalEntryFormHandle>(null)
  const [doc, setDoc] = useState<JournalEntryDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<"Save" | "Submit" | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    journalEntryService.getById(id).then(setDoc).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const run = async (action: "Save" | "Submit") => {
    if (!id) return
    setError("")
    setActing(action)
    try {
      await formRef.current?.save(action)
      navigate(`/journal-entries/${encodeURIComponent(id)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save journal entry.")
    } finally {
      setActing(null)
    }
  }

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!doc) return <><Topbar /><div className="p-6 text-center text-muted">Entry not found</div></>

  const submitted = Number(doc.docstatus) === 1

  return (
    <>
      <Topbar />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to={`/journal-entries/${encodeURIComponent(id ?? "")}`} className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => run("Save")} loading={acting === "Save"} disabled={submitted}>
              <Save size={14} /> Save
            </Button>
            <Button onClick={() => run("Submit")} loading={acting === "Submit"} disabled={submitted}>
              <Send size={14} /> Submit
            </Button>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">Edit Journal Entry</h1>
        {error && (
          <div className="mb-4 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            {error}
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-card p-6">
          <JournalEntryForm ref={formRef} mode="edit" doc={doc} />
        </div>
      </motion.div>
    </>
  )
}