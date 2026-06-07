export const patientDomainBoundary = Object.freeze({
  title: 'Pacientes',
  description: 'Cadastro clínico e histórico do paciente.',
})

export const contactsDomainBoundary = Object.freeze({
  title: 'Contatos',
  description: 'CRM unificado para pacientes e leads.',
})

export const relationshipDomainBoundary = Object.freeze({
  title: 'Relacionamento (CRM)',
  description: 'timeline, notas e contexto comercial ficam em Contatos.',
})

export function getContactOwnershipCopy(contactType: 'patient' | 'lead') {
  if (contactType === 'patient') {
    return {
      title: 'Contato (CRM)',
      description: 'Contatos mostra timeline e relacionamento. cadastro clínico continua em Pacientes.',
    }
  }

  return {
    title: 'Contato (CRM)',
    description: 'Este lead vive em Contatos até virar paciente.',
  }
}
