"use client"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Edit, Trash2, Mail, Phone, Building2, User } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton, Button, Badge, Modal, Link } from "@/components/ui"
import { contactService, type Contact } from "@/services"

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
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

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!contact) return <><Topbar /><div className="p-6 text-center text-muted">Contact not found</div></>

  const fullName = [contact.salutation, contact.first_name, contact.middle_name, contact.last_name].filter(Boolean).join(" ")
  const linkedCustomer = contact.links.find((l) => l.link_doctype === "Customer")

  return (
    <>
      <Topbar />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/contacts" className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back to Contacts
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/contacts/${id}/edit`)}><Edit size={14} /> Edit</Button>
            <Button variant="outline" onClick={() => setShowDeleteModal(true)} className="text-danger-600 border-danger-200 hover:bg-danger-50"><Trash2 size={14} /> Delete</Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center">
                <User size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-heading">{fullName || contact.first_name}</h1>
                {contact.company_name && (
                  <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5">
                    <Building2 size={14} /> {contact.company_name}
                  </p>
                )}
              </div>
            </div>
            <Badge variant={contact.is_primary_contact ? "success" : "muted"} className="px-3 py-1 text-sm">
              {contact.is_primary_contact ? "Primary Contact" : "Secondary"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Contact Details</p>
              <div className="space-y-3">
                {contact.designation && (
                  <div><span className="text-xs text-muted">Designation</span><p className="text-sm text-body font-medium">{contact.designation}</p></div>
                )}
                {contact.department && (
                  <div><span className="text-xs text-muted">Department</span><p className="text-sm text-body font-medium">{contact.department}</p></div>
                )}
                {contact.gender && (
                  <div><span className="text-xs text-muted">Gender</span><p className="text-sm text-body font-medium">{contact.gender}</p></div>
                )}
                {contact.email_id && (
                  <div className="flex items-center gap-2"><Mail size={14} className="text-muted" /><span className="text-sm text-body">{contact.email_id}</span></div>
                )}
                {contact.mobile_no && (
                  <div className="flex items-center gap-2"><Phone size={14} className="text-muted" /><span className="text-sm text-body">{contact.mobile_no}</span></div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2"><Phone size={14} className="text-muted" /><span className="text-sm text-body">{contact.phone}</span></div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Linked To</p>
              {linkedCustomer ? (
                <div>
                  <span className="text-xs text-muted">Customer</span>
                  <Link to={`/customers/${linkedCustomer.link_name}`} className="block text-sm font-semibold text-primary-600 hover:underline mt-0.5">
                    {linkedCustomer.link_title || linkedCustomer.link_name}
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted">Not linked to any record</p>
              )}
            </div>
          </div>

          {contact.email_ids.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">All Email Addresses</p>
              <div className="space-y-1.5">
                {contact.email_ids.map((e, i) => (
                  <div key={e.name ?? i} className="flex items-center gap-2 text-sm">
                    <Mail size={14} className="text-muted" />
                    <span>{e.email_id}</span>
                    {e.is_primary ? <Badge variant="success" className="text-[10px] px-1.5 py-0">Primary</Badge> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {contact.phone_nos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">All Phone Numbers</p>
              <div className="space-y-1.5">
                {contact.phone_nos.map((p, i) => (
                  <div key={p.name ?? i} className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-muted" />
                    <span>{p.phone}</span>
                    {p.is_primary_mobile_no ? <Badge variant="success" className="text-[10px] px-1.5 py-0">Primary</Badge> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {contact.is_billing_contact ? (
            <Badge variant="info">Billing Contact</Badge>
          ) : null}

          <p className="text-xs text-muted pt-4 border-t border-border">
            Created {new Date(contact.creation).toLocaleDateString()} &middot; Modified {new Date(contact.modified).toLocaleDateString()}
          </p>
        </div>
      </motion.div>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Contact">
        <p>Are you sure you want to delete <strong>{fullName || contact.first_name}</strong>?</p>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
        </div>
      </Modal>
    </>
  )
}
