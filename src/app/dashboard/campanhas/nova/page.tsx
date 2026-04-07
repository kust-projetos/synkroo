'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useToast } from '@/lib/ui/toast'

const MESSAGE_TEMPLATES: Record<string, string> = {
  inactive_30: `Olá, {{patient_name}}! 👋

Sentimos sua falta! Já faz um tempo desde sua última visita.

Que tal agendar uma consulta de retorno? Sua saúde bucal agradece! 🦷

📅 Responda essa mensagem que eu te ajudo a agendar.`,
  inactive_60: `Olá, {{patient_name}}! 💙

Faz 2 meses que não apareceu na clínica. Estamos com horários disponíveis!

✨ Agende sua consulta de retorno e mantenha seu sorriso saudável.

📱 É só responder essa mensagem!`,
  inactive_90: `Olá, {{patient_name}}! 🦷

Faz 3 meses que não te vemos. Sua saúde bucal é importante!

🎁 Vamos oferecer um desconto especial de 10% para sua próxima consulta!

📅 Agende agora respondendo essa mensagem.`,
  custom: '',
}

export default function NovaCampanhaPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campaign_type: 'reactivation',
    target_segment: 'inactive_60',
    message_template: MESSAGE_TEMPLATES.inactive_60,
    channel: 'whatsapp',
    scheduled_at: '',
    auto_add_recipients: true,
  })

  const clinicId = profile?.clinic_id

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Update message template when segment changes
    if (name === 'target_segment' && value in MESSAGE_TEMPLATES) {
      setFormData((prev) => ({
        ...prev,
        message_template: MESSAGE_TEMPLATES[value] || prev.message_template,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          name: formData.name,
          description: formData.description || null,
          campaign_type: formData.campaign_type,
          target_segment: formData.target_segment,
          message_template: formData.message_template,
          channel: formData.channel,
          scheduled_at: formData.scheduled_at || null,
          auto_start: formData.auto_add_recipients && formData.campaign_type === 'reactivation',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.showToast(data.error || 'Erro ao criar campanha', 'error')
        return
      }

      toast.showToast('Campanha criada com sucesso!', 'success')
      router.push('/dashboard/campanhas')
    } catch (err) {
      toast.showToast('Erro de conexão. Tente novamente.', 'error')
      console.error('Error creating campaign:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/campanhas" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nova Campanha</h1>
              <p className="text-sm text-gray-500">Crie uma campanha de reativação ou follow-up</p>
            </div>
          </div>
        </div>

      {/* Form */}
      <div className="max-w-3xl">
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome da Campanha *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ex: Reativação Março 2026"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Descrição interna da campanha"
            />
          </div>

          {/* Campaign Type and Target Segment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="campaign_type" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Campanha *
              </label>
              <select
                id="campaign_type"
                name="campaign_type"
                value={formData.campaign_type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="reactivation">Reativação</option>
                <option value="retention">Retenção</option>
                <option value="promotional">Promocional</option>
                <option value="follow_up">Follow-up</option>
              </select>
            </div>
            <div>
              <label htmlFor="target_segment" className="block text-sm font-medium text-gray-700 mb-1">
                Segmento Alvo
              </label>
              <select
                id="target_segment"
                name="target_segment"
                value={formData.target_segment}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="inactive_30">Inativos 30-59 dias</option>
                <option value="inactive_60">Inativos 60-89 dias</option>
                <option value="inactive_90">Inativos 90-179 dias</option>
                <option value="inactive_180">Inativos 6+ meses</option>
                <option value="custom">Segmento Personalizado</option>
              </select>
            </div>
          </div>

          {/* Channel */}
          <div>
            <label htmlFor="channel" className="block text-sm font-medium text-gray-700 mb-1">
              Canal de Envio
            </label>
            <select
              id="channel"
              name="channel"
              value={formData.channel}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </div>

          {/* Message Template */}
          <div>
            <label htmlFor="message_template" className="block text-sm font-medium text-gray-700 mb-1">
              Modelo de Mensagem *
            </label>
            <textarea
              id="message_template"
              name="message_template"
              value={formData.message_template}
              onChange={handleChange}
              required
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              placeholder="Olá, {{patient_name}}!..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Use {'{{patient_name}}'} para personalizar com o nome do paciente
            </p>
          </div>

          {/* Scheduled At */}
          <div>
            <label htmlFor="scheduled_at" className="block text-sm font-medium text-gray-700 mb-1">
              Agendar Envio (opcional)
            </label>
            <input
              type="datetime-local"
              id="scheduled_at"
              name="scheduled_at"
              value={formData.scheduled_at}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Deixe em branco para salvar como rascunho
            </p>
          </div>

          {/* Auto Add Recipients */}
          {formData.campaign_type === 'reactivation' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_add_recipients"
                name="auto_add_recipients"
                checked={formData.auto_add_recipients}
                onChange={handleChange}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="auto_add_recipients" className="text-sm text-gray-700">
                Adicionar automaticamente pacientes do segmento selecionado
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/dashboard/campanhas"
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              )}
              {loading ? 'Criando...' : 'Criar Campanha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}