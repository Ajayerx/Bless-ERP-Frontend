"use client"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Link } from "@/components/ui"
import { contactService, type ContactFormData } from "@/services/contacts.service"
import ContactForm from "@/modules/contacts/ContactForm"

export default function NewContact() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data: ContactFormData) => {
    setLoading(true)
    try {
      const res = await contactService.create(data)
      navigate(`/contacts/${res.id}`)
    } finally { setLoading(false) }
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/contacts"><ArrowLeft size={18} /><span>Back to Contacts</span></Link>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">New Contact</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <ContactForm onSubmit={onSubmit} loading={loading} />
        </div>
      </motion.div>
    </>
  )
}
