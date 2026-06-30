"use client"
import { useForm } from "react-hook-form"
import { Button, Input, Select, Textarea } from "@/components/ui"
import type { ContactFormData } from "@/services/contacts.service"

interface Props {
  defaultValues?: Partial<ContactFormData>
  onSubmit: (data: ContactFormData) => Promise<void>
  loading?: boolean
}

export default function ContactForm({ defaultValues, onSubmit, loading }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<ContactFormData>({ defaultValues })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="submit" loading={loading}>Save Contact</Button>
      </div>
    </form>
  )
}
