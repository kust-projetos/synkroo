'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/pacientes" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Novo Paciente</h1>
              <p className="text-sm text-gray-500">Cadastre um novo paciente na clínica</p>
            </div>
          </div>
        </div>

      {/* Form */}
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nome do paciente"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefone / WhatsApp *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handlePhoneChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="(99) 99999-9999"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="email@exemplo.com"
            />
          </div>

          {/* CPF and Birth Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
                CPF
              </label>
              <input
                type="text"
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleCpfChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="999.999.999-99"
              />
            </div>
            <div>
              <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-1">
                Data de Nascimento
              </label>
              <input
                type="date"
                id="birth_date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Adicionar tag (ex: VIP, Novo)"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Adicionar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Alergias, observações médicas, preferências..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/dashboard/pacientes"
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              {loading ? 'Salvando...' : 'Salvar Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}