"use client"
import { forwardRef, useImperativeHandle } from "react"
import { useForm } from "react-hook-form"
import { Input, Select, Textarea } from "@/components/ui"
import type { OpportunityFormData } from "@/services/opportunities.service"

interface Props {
  defaultValues?: Partial<OpportunityFormData>
  onSubmit: (data: OpportunityFormData) => Promise<void>
}

export interface OpportunityFormRef {
  submit: () => void
}

export default forwardRef<OpportunityFormRef, Props>(function OpportunityForm({ defaultValues, onSubmit }, ref) {
  const { register, handleSubmit, formState: { errors } } = useForm<OpportunityFormData>({ defaultValues })

  useImperativeHandle(ref, () => ({
    submit: handleSubmit(onSubmit),
  }))

  return (
    <form className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Title" {...register("title", { required: "Required" })} error={errors.title?.message} />
        <Input label="Customer Name" {...register("customerName", { required: "Required" })} error={errors.customerName?.message} />
        <Input label="Value ($)" type="number" {...register("value", { valueAsNumber: true, required: "Required" })} error={errors.value?.message} />
        <Select label="Stage" {...register("stage", { required: "Required" })}>
          <option value="qualification">Qualification</option>
          <option value="proposal">Proposal</option>
          <option value="negotiation">Negotiation</option>
          <option value="closed_won">Closed Won</option>
          <option value="closed_lost">Closed Lost</option>
        </Select>
        <Input label="Probability (%)" type="number" {...register("probability", { valueAsNumber: true, min: 0, max: 100 })} />
        <Input label="Expected Close" type="date" {...register("expectedClose", { required: "Required" })} error={errors.expectedClose?.message} />
        <Input label="Assigned To" {...register("assignedTo", { required: "Required" })} error={errors.assignedTo?.message} />
      </div>
      <Textarea label="Notes" {...register("notes")} />
    </form>
  )
})
