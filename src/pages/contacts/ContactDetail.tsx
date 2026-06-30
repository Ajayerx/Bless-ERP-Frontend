"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Edit, Trash2 } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Link, Badge, Modal } from "@/components/ui"
import { contactService, type Contact } from "@/services/contacts.service"

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!id) return
    contactService.getById(id).then(setContact).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await contactService.delete(id)
      navigate("/contacts")
    } finally { setDeleting(false); setShowDeleteModal(false) }
  }

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>

  if (!contact) return <><Topbar /><div className="p-6 text-center text-muted">Contact not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/contacts"><ArrowLeft size={18} /><span>Back to Contacts</span></Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/contacts/${id}/edit`)}><Edit size={14} /> Edit</Button>
            <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50"><Trash2 size={14} /> Delete</Button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-heading">{contact.name}</h1>
            <Badge variant={contact.isPrimary ? "success" : "muted"}>{contact.isPrimary ? "Primary" : "Secondary"}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">Email</span><p className="text-body font-medium">{contact.email}</p></div>
            <div><span className="text-muted">Phone</span><p className="text-body font-medium">{contact.phone}</p></div>
            <div><span className="text-muted">Role</span><p className="text-body font-medium">{contact.role}</p></div>
          </div>
          {contact.notes && <div><span className="text-sm text-muted">Notes</span><p className="text-sm text-body mt-1">{contact.notes}</p></div>}
        </div>
      </motion.div>
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Contact">
        <p>Are you sure you want to delete <strong>{contact.name}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
        </div>
      </Modal>
    </>
  )
}
