# Padrão de Página — Synkroo Frontend

> Aplicável a todas as páginas de domínio do SaaS odontológico.
> W6 · Componentes existentes em `src/components/ui/`.

## 1. Padrões de página

O Synkroo segue três padrões de página — **Lista**, **Detalhe**, **Formulário**.
Cada padrão usa componentes compartilhados de `src/components/ui/`.
As mutações (criar/atualizar/deletar) sempre usam **Server Action → `runAction`** — nunca acesso direto ao DB no client.

### 1.1 Lista

Estrutura: `page-header` → `filter-bar` + `search-input` → `data-table` → `empty-state`

```tsx
import { PageHeader } from '@/components/ui/page-header'
import { FilterBar } from '@/components/ui/filter-bar'
import { SearchInput } from '@/components/ui/search-input'
import { DataTable } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'

export default async function PatientsPage() {
  const patients = await getPatients()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pacientes"
        description={`${patients.length} paciente(s)`}
        action={<Button onClick={() => router.push('/pacientes/novo')}>Novo paciente</Button>}
      />
      <FilterBar>
        <SearchInput placeholder="Buscar por nome..." />
        {/* filtros adicionais */}
      </FilterBar>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : patients.length === 0 ? (
        <EmptyState
          title="Nenhum paciente"
          description="Cadastre seu primeiro paciente para começar."
          action={<Button>Novo paciente</Button>}
        />
      ) : (
        <DataTable columns={columns} data={patients} />
      )}
    </div>
  )
}
```

### 1.2 Detalhe

Estrutura: `page-header` (com back-link) → `detail-page` → `status-badge`

```tsx
import { PageHeader } from '@/components/ui/page-header'
import { BackLink } from '@/components/ui/back-link'
import { DetailPage } from '@/components/ui/detail-page'
import { StatusBadge } from '@/components/ui/status-badge'

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const patient = await getPatient(params.id)
  if (!patient) notFound()

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/pacientes">Voltar para Pacientes</BackLink>
      <PageHeader
        title={patient.name}
        description={`CPF ${patient.cpf}`}
        action={<StatusBadge status={patient.status} />}
      />
      <DetailPage>
        <DetailPage.Section title="Dados pessoais">
          <DetailPage.Field label="E-mail" value={patient.email} />
          <DetailPage.Field label="Telefone" value={patient.phone} />
        </DetailPage.Section>
      </DetailPage>
    </div>
  )
}
```

### 1.3 Formulário

Estrutura: `page-header` (com back-link) → `form-page` → campos + Server Action via `runAction`

```tsx
'use server'

import { z } from 'zod'
import { runAction } from '@/core/actions'
import { createPatientAction } from '@/modules/crm/actions/create-patient'

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(8),
})

export async function createPatient(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  return runAction(createPatientAction, parsed.data)
}
```

```tsx
// Página de formulário
'use client'

import { useFormStatus } from 'react-dom'
import { PageHeader } from '@/components/ui/page-header'
import { FormPage } from '@/components/ui/form-page'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createPatient } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar'}</Button>
}

export default function NewPatientPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Novo Paciente" description="Cadastre um novo paciente na clínica." />
      <FormPage action={createPatient}>
        <FormPage.Field error={/* field error */}>
          <Input name="name" label="Nome completo" required />
        </FormPage.Field>
        <FormPage.Field error={/* field error */}>
          <Input name="email" label="E-mail" type="email" required />
        </FormPage.Field>
        <FormPage.Field error={/* field error */}>
          <Input name="phone" label="Telefone" type="tel" />
        </FormPage.Field>
        <FormPage.Actions>
          <SubmitButton />
        </FormPage.Actions>
      </FormPage>
    </div>
  )
}
```

---

## 2. Server Action — `runAction`

Todas as mutações (create, update, delete) usam **Server Actions** via `runAction`.

```ts
import { runAction } from '@/core/actions'

// Definição da action (em qualquer módulo)
export const createPatientAction = defineAction({
  name: 'createPatient',
  requires: 'crm:create_patient',
  async execute({ clinicId }, input: CreatePatientInput) {
    // lógica de domínio
  },
})

// Chamada no client (form action ou event handler)
const result = await runAction(createPatientAction, { name: 'Ana', email: 'ana@example.com' })
if (!result.ok) return { error: result.error }
```

> **Por que `runAction`?** Centraliza validação de auth, RBAC, logging e tratamento de erros em um ponto. O client nunca chama DB direto.

---

## 3. Componentes de referência

| Componente | Caminho | Uso |
|---|---|---|
| `PageHeader` | `src/components/ui/page-header.tsx` | Título, descrição e ação de página |
| `FilterBar` | `src/components/ui/filter-bar.tsx` | Container de filtros + busca |
| `SearchInput` | `src/components/ui/search-input.tsx` | Campo de busca com ícone |
| `DataTable` | `src/components/ui/data-table.tsx` | Tabela com ordenação, paginação |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Estado vazio (sem dados) |
| `ErrorState` | `src/components/ui/ErrorState.tsx` | Estado de erro |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Loading state |
| `BackLink` | `src/components/ui/back-link.tsx` | Link de retorno |
| `DetailPage` | `src/components/ui/detail-page.tsx` | Container de detalhe com seções |
| `FormPage` | `src/components/ui/form-page.tsx` | Container de formulário |
| `StatusBadge` | `src/components/ui/status-badge.tsx` | Badge de status colorido |

---

## 4. Referência: painel de acessos (W3.5)

O painel de acessos (`/dashboard/configuracoes/acessos`) é a página-modelo que exemplifica o padrão completo:

- **Lista**: `DataTable` com ações (editar, remover)
- **Formulário**: `FormPage` com Server Action para atribuir/remover permissões
- **Server Action**: `runAction(assignUserAccess, ...)` com validação Zod
- **RBAC**: `resolveAccess` filtra ações disponíveis por role

> Ver `src/modules/core/ui/UserAccessForm.tsx` e `src/modules/core/actions/assign-user-access.ts` como referência de implementação.

---

## 5. Menu modular — W6

O menu do dashboard é construído a partir de `manifest.menu` de cada módulo, filtrado por
`filterMenuByAccess` (W3.3) e `buildMenu` (W6).

```ts
// src/lib/ui/build-menu.ts
import { buildMenu } from '@/lib/ui/build-menu'
import { coreManifest } from '@/modules/core/manifest'

const manifests = [coreManifest]
const manifest = makeManifest(repo)
const can = (permission: string) =>
  resolveAccess(userId, clinicId, repo).then(r => r.can(permission))

const menu = await buildMenu(manifests, manifest, can)
```

> Até W7: `can` retorna `true` para todos os itens do `core` (autenticado = tem acesso).
> W7+: integrar `resolveAccess` para verificação real por role.
