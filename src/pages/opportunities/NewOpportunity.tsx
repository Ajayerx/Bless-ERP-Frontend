"use client"
import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Link } from "@/components/ui"
import { opportunityService, type OpportunityFormData } from "@/services/opportunities.service"
import OpportunityForm, { type OpportunityFormRef } from "@/modules/opportunities/OpportunityForm"

export default function NewOpportunity() {
  const navigate = useNavigate()
  const formRef = useRef<OpportunityFormRef>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data: OpportunityFormData) => {
    setLoading(true)
    try {
      const res = await opportunityService.create(data)
      navigate(`/opportunities/${res.id}`)
    } finally { setLoading(false) }
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-6">
          <Link to="/opportunities" className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /> Back to Opportunities
          </Link>
          <Button onClick={() => formRef.current?.submit()} loading={loading}><Save size={14} /> Save Opportunity</Button>
        </div>
        <h1 className="text-2xl font-bold text-heading mb-6">New Opportunity</h1>
        <div className="bg-white rounded-2xl shadow-card p-6">
          <OpportunityForm ref={formRef} onSubmit={onSubmit} />
        </div>
      </motion.div>
    </>
  )
}
