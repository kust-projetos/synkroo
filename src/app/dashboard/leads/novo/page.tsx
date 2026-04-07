'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type LeadSource = 'whatsapp' | 'instagram' | 'web' | 'referral' | 'campaign' | 'other'

const sourceLabels: Record<LeadSource, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  web: 'Website',
  referral: 'Indicação',
  campaign: 'Campanha',
  other: 'Outro',
}

export default function NovoLeadPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'whatsapp' as LeadSource,
    interest: '',
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.phone) {
      setError('Nome e telefone são obrigatórios')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/dashboard/leads/${data.lead.id}`)
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao criar lead')
      }
    } catch (err) {
      setError('Erro ao criar lead')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/leads"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Voltar para Leads
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Novo Lead</h1>
          <p className="text-gray-600 mt-1">Cadastre um novo prospect no pipeline</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nome completo"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="(11) 99999-9999"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="email@exemplo.com"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Origem
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as LeadSource })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Object.entries(sourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Interest */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interesse
              </label>
              <input
                type="text"
                value={formData.interest}
                onChange={(e) => setFormData({ ...formData, interest: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ex: Clareamento, Implante, Ortodontia..."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
                placeholder="Informações adicionais sobre o lead..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Link
              href="/dashboard/leads"
              className="flex-1 text-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Salvando...' : 'Salvar Lead'}
            </button>
          </div>
        </form>
    </div>
  )
}