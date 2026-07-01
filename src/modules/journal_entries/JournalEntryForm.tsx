"use client"
import { forwardRef, useImperativeHandle } from "react"
import { useForm } from "react-hook-form"
import { Input, Select, Textarea } from "@/components/ui"
import type { JournalEntryFormData } from "@/services/journal_entries.service"

interface Props {
  defaultValues?: Partial<JournalEntryFormData>
  onSubmit: (data: JournalEntryFormData) => Promise<void>
}

export interface JournalEntryFormRef {
  submit: () => void
}

export default forwardRef<JournalEntryFormRef, Props>(function JournalEntryForm({ defaultValues, onSubmit }, ref) {
  const { register, handleSubmit, formState: { errors } } = useForm<JournalEntryFormData>({ defaultValues })

  useImperativeHandle(ref, () => ({
    submit: handleSubmit(onSubmit),
  }))

  return (
    <form className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" type="date" {...register("date", { required: "Required" })} error={errors.date?.message} />
        <Select label="Status" {...register("status")}>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </Select>
        <Input label="Account" {...register("account", { required: "Required" })} error={errors.account?.message} />
        <Input label="Counter Account" {...register("counterAccount", { required: "Required" })} error={errors.counterAccount?.message} />
        <Input label="Debit ($)" type="number" {...register("debit", { valueAsNumber: true, min: 0 })} />
        <Input label="Credit ($)" type="number" {...register("credit", { valueAsNumber: true, min: 0 })} />
      </div>
      <Textarea label="Description" {...register("description", { required: "Required" })} error={errors.description?.message} />
    </form>
  )
})
