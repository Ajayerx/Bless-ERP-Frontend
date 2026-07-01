"use client"
import { forwardRef, useImperativeHandle } from "react"
import { useForm } from "react-hook-form"
import { Input, Select, Textarea } from "@/components/ui"
import type { ContactFormData } from "@/services/contacts.service"

interface Props {
  defaultValues?: Partial<ContactFormData>
  onSubmit: (data: ContactFormData) => Promise<void>
}

export interface ContactFormRef {
  submit: () => void
}

export default forwardRef<ContactFormRef, Props>(function ContactForm({ defaultValues, onSubmit }, ref) {
  const { register, handleSubmit, formState: { errors } } = useForm<ContactFormData>({ defaultValues })

  useImperativeHandle(ref, () => ({
    submit: handleSubmit(onSubmit),
  }))

  return (
    <form className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Full Name" {...register("name", { required: "Required" })} error={errors.name?.message} />
        <Input label="Email" type="email" {...register("email", { required: "Required" })} error={errors.email?.message} />
        <Input label="Phone" {...register("phone", { required: "Required" })} error={errors.phone?.message} />
        <Input label="Role" {...register("role", { required: "Required" })} error={errors.role?.message} />
        <Select label="Is Primary" {...register("isPrimary")}>
          <option value="false">Secondary</option>
          <option value="true">Primary</option>
        </Select>
      </div>
      <Textarea label="Notes" {...register("notes")} />
    </form>
  )
})
