'use client'

import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FormPage } from '@/components/ui/form-page'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function NovoDentistaPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    specialty: '',
    cro_number: '',
  })

  const handleSubmit = async () => {
    setSaving(true)

    try {
      const response = await fetch('/api/dentists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: profile?.clinic_id,
          ...form,
        }),
      })

      if (response.ok) {
        router.push('/dashboard/dentistas')
      }
    } catch (error) {
      console.error('Error creating dentist:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormPage
      title="Novo Dentista"
      backHref="/dashboard/dentistas"
      onSubmit={handleSubmit}
      loading={saving}
    >
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
        <Input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Email</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Especialidade</label>
          <select
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">Selecione...</option>
            <option value="Clínico Geral">Clínico Geral</option>
            <option value="Ortodontia">Ortodontia</option>
            <option value="Implantodontia">Implantodontia</option>
            <option value="Endodontia">Endodontia</option>
            <option value="Periodontia">Periodontia</option>
            <option value="Odontopediatria">Odontopediatria</option>
            <option value="Estética Dental">Estética Dental</option>
            <option value="Prótese">Prótese</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">CRO</label>
          <Input
            type="text"
            value={form.cro_number}
            onChange={(e) => setForm({ ...form, cro_number: e.target.value })}
            placeholder="00000/UF"
          />
        </div>
      </div>
    </FormPage>
  )
}
