'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'
import { FormPage } from '@/components/ui/form-page'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function NovoPacientePage() {
  const router = useRouter()
  const { profile } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    birth_date: '',
    notes: '',
    tags: [] as string[],
  })
  const [newTag, setNewTag] = useState('')

  // Get clinic ID from auth context
  const clinicId = profile?.clinic_id

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Format phone as user types
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 11) value = value.slice(0, 11)

    // Format: (99) 99999-9999
    if (value.length > 7) {
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
    } else if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`
    } else if (value.length > 0) {
      value = `(${value}`
    }

    setFormData(prev => ({ ...prev, phone: value }))
  }

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Format CPF as user types
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 11) value = value.slice(0, 11)

    // Format: 999.999.999-99
    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`
    }

    setFormData(prev => ({ ...prev, cpf: value }))
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }))
  }

  const handleSubmit = async () => {
    if (!clinicId) {
      toast.showToast('Clínica não encontrada', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          name: formData.name,
          phone: formData.phone.replace(/\D/g, ''),
          email: formData.email || null,
          cpf: formData.cpf.replace(/\D/g, '') || null,
          birth_date: formData.birth_date || null,
          notes: formData.notes || null,
          tags: formData.tags,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          toast.showToast('Já existe um paciente com este telefone', 'error')
        } else {
          toast.showToast(data.error || 'Erro ao criar paciente', 'error')
        }
        return
      }

      toast.showToast('Paciente cadastrado com sucesso!', 'success')
      router.push('/dashboard/pacientes')
    } catch (err) {
      toast.showToast('Erro de conexão. Tente novamente.', 'error')
      console.error('Error creating patient:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormPage
      title="Novo Paciente"
      backHref="/dashboard/pacientes"
      onSubmit={handleSubmit}
      loading={loading}
      submitLabel="Salvar Paciente"
    >
      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
          Nome completo *
        </label>
        <Input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Nome do paciente"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
          Telefone / WhatsApp *
        </label>
        <Input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handlePhoneChange}
          required
          placeholder="(99) 99999-9999"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <Input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="email@exemplo.com"
        />
      </div>

      {/* CPF and Birth Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cpf" className="block text-sm font-medium text-foreground mb-1">
            CPF
          </label>
          <Input
            type="text"
            id="cpf"
            name="cpf"
            value={formData.cpf}
            onChange={handleCpfChange}
            placeholder="999.999.999-99"
          />
        </div>
        <div>
          <label htmlFor="birth_date" className="block text-sm font-medium text-foreground mb-1">
            Data de Nascimento
          </label>
          <Input
            type="date"
            id="birth_date"
            name="birth_date"
            value={formData.birth_date}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Tags
        </label>
        <div className="flex gap-2 mb-2">
          <Input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Adicionar tag (ex: VIP, Novo)"
          />
          <Button
            type="button"
            onClick={addTag}
            variant="secondary"
          >
            Adicionar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.tags.map((tag, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 hover:opacity-70"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-1">
          Observações
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
          placeholder="Alergias, observações médicas, preferências..."
        />
      </div>
    </FormPage>
  )
}
