# Domain Research - Synkroo

**Data:** 2026-03-24
**Metodologia:** BMAD Domain Research
**Status:** ✅ Atualizado

---

## Executive Summary

Este documento consolida o conhecimento de domínio necessário para desenvolver uma plataforma de IA para clínicas, incluindo: regulamentações brasileiras, processos clínicos, terminologia técnica, fluxos de trabalho e boas práticas.

---

## 1. Regulamentações Brasileiras

### 1.1 Conselhos Profissionais

| Conselho | Sigla | Função | Relevância |
|----------|-------|--------|------------|
| Conselho Federal de Odontologia | CFO | Regula ortodontistas, dentistas | **Alta** - Segmento inicial |
| Conselho Federal de Medicina | CFM | Regula médicos | Alta - Clínicas médicas |
| Conselho Federal de Fisioterapia | COFFITO | Regula fisioterapeutas | Média - Expansão futura |
| Conselho Regional de Enfermagem | COREN | Regula enfermeiros | Média |
| Agência Nacional de Vigilância Sanitária | ANVISA | Regula procedimentos, equipamentos | Alta |

### 1.2 CFO - Resoluções Relevantes

| Resolução | Conteúdo | Impacto no Sistema |
|-----------|----------|-------------------|
| **CFO-118/2012** | Prontuário odontológico | Obrigação de manter registros |
| **CFO-22/2001** | Código de Ética | Consentimento, sigilo |
| **CFO-196/2020** | Teleodontologia | Atendimento remoto pós-pandemia |

**Requisitos do Prontuário Odontológico (CFO-118/2012):**

```
Conteúdo Obrigatório:
├── Identificação do paciente
├── Anamnese
├── Exame clínico
├── Diagnóstico
├── Plano de tratamento
├── Evolução
├── Procedimentos realizados
├── Receitas e atestados
├── Radiografias
└── Consentimento livre e esclarecido
```

### 1.3 LGPD - Aplicabilidade em Saúde

**Dados Sensíveis em Clínicas:**

| Tipo de Dado | Exemplos | Tratamento LGPD |
|---------------|----------|-----------------|
| **Dados de saúde** | Diagnósticos, tratamentos, medicamentos | Consentimento obrigatório (Art. 11) |
| **Dados biométricos** | Fotos intra-orais, digitalizações | Consentimento obrigatório |
| **Dados de crianças** | Prontuários pediátricos | Consentimento dos responsáveis |
| **Dados financeiros** | Pagamentos, convênios | Base contratual |

**Artigos Críticos para IA:**

```
Art. 20 - Decisões Automatizadas:
├── Direito de revisão de decisões tomadas por IA
├── Obrigação de transparência sobre uso de IA
├── Direito a explicação sobre critérios utilizados
└── Direito de solicitar intervenção humana
```

### 1.4 ANVISA - Requisitos

| RDC | Conteúdo | Aplicabilidade |
|-----|----------|----------------|
| **RDC 48/2013** | Registros eletrônicos | Autenticação, assinatura digital |
| **RDC 306/2004** | Gestão de resíduos | Não se aplica à IA |
| **RDC 36/2013** | Materiais de consumo | Não se aplica à IA |

---

## 2. Processos Clínicos

### 2.1 Jornada do Paciente em Clínica Odontológica

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    JORNADA DO PACIENTE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. DESCOBERTA                                                         │
│     ├── Indicação de amigo/familiar                                    │
│     ├── Google / Google Maps                                           │
│     ├── Instagram / Redes sociais                                      │
│     ├── Anúncios (tráfego pago)                                        │
│     └── Passando em frente                                             │
│                                                                         │
│  2. PRIMEIRO CONTATO                                                   │
│     ├── WhatsApp / Instagram DM                                        │
│     ├── Telefone                                                       │
│     └── Presencial                                                     │
│                                                                         │
│  3. AGENDAMENTO                                                        │
│     ├── Verificação de disponibilidade                                 │
│     ├── Coleta de dados básicos                                        │
│     └── Confirmação                                                    │
│                                                                         │
│  4. PRIMEIRA CONSULTA                                                  │
│     ├── Recepção e cadastro                                            │
│     ├── Anamnese                                                       │
│     ├── Exame clínico                                                  │
│     ├── Exames complementares (se necessário)                          │
│     ├── Diagnóstico                                                    │
│     ├── Plano de tratamento                                            │
│     └── Orçamento                                                      │
│                                                                         │
│  5. TRATAMENTO                                                         │
│     ├── Múltiplas sessões                                              │
│     ├── Procedimentos                                                  │
│     └── Ajustes e acompanhamento                                       │
│                                                                         │
│  6. PÓS-TRATAMENTO                                                     │
│     ├── Orientações                                                    │
│     ├── Retorno de controle                                            │
│     └── Manutenção                                                     │
│                                                                         │
│  7. RETENÇÃO                                                           │
│     ├── Lembretes de retorno periódico                                 │
│     ├── Campanhas de saúde bucal                                       │
│     └── Relacionamento contínuo                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Agendamento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE AGENDAMENTO                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PACIENTE solicita agendamento                                         │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────┐                                                    │
│  │ Verificar se    │─── Novo ───► Coletar dados básicos               │
│  │ é paciente novo │                  │                                 │
│  └────────┬────────┘                  │                                 │
│           │ Existente                 │                                 │
│           ▼                           ▼                                 │
│  ┌─────────────────────────────────────────────────┐                   │
│  │           Verificar disponibilidade             │                   │
│  │  (Profissional, data, horário, duração)        │                   │
│  └──────────────────────┬──────────────────────────┘                   │
│                         │                                               │
│          ┌──────────────┴──────────────┐                               │
│          ▼                             ▼                               │
│    Disponível                    Indisponível                          │
│          │                             │                               │
│          ▼                             ▼                               │
│  Confirmar agendamento     Oferecer alternativas                       │
│          │                   • Outro horário                           │
│          │                   • Outro profissional                      │
│          │                   • Lista de espera                         │
│          │                             │                               │
│          └─────────────────────────────┘                               │
│                         │                                               │
│                         ▼                                               │
│           Registrar no sistema                                          │
│                         │                                               │
│                         ▼                                               │
│           Enviar confirmação                                            │
│                         │                                               │
│                         ▼                                               │
│           Agendar lembretes                                             │
│           • 24h antes                                                   │
│           • 2h antes                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Fluxo de No-Show

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE NO-SHOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Horário da consulta chega                                              │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────┐                                                    │
│  │ Paciente        │─── Compareceu ───► Atendimento normal             │
│  │ compareceu?     │                                                    │
│  └────────┬────────┘                                                    │
│           │ Não                                                         │
│           ▼                                                             │
│  Aguardar 15-30 minutos                                                  │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────┐                                                    │
│  │ Tentar contato  │                                                    │
│  │ (WhatsApp/tel)  │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│          ┌┴────────────────────┐                                        │
│          ▼                     ▼                                        │
│    Respondeu             Não respondeu                                  │
│          │                     │                                        │
│          ▼                     ▼                                        │
│  ┌─────────────┐      Registrar no-show                                 │
│  │ Reagendar   │              │                                         │
│  └──────┬──────┘              │                                         │
│         │                     │                                         │
│         └─────────────────────┘                                         │
│                         │                                               │
│                         ▼                                               │
│           Ações automáticas:                                            │
│           • Atualizar taxa de no-show do paciente                      │
│           • Notificar clínica                                           │
│           • Agendar follow-up para reagendamento                        │
│           • Liberar horário para lista de espera                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Procedimentos Odontológicos Comuns

| Especialidade | Procedimentos | Duração Média | Recall |
|---------------|---------------|---------------|--------|
| **Prevenção** | Limpeza, aplicação flúor | 30-60 min | 6 meses |
| **Restauradora** | Obturação, restauração | 30-90 min | - |
| **Endodontia** | Tratamento de canal | 60-120 min | 1 ano |
| **Ortodontia** | Aparelho, manutenção | 30-60 min | 1-2 meses |
| **Implantodontia** | Implante, coroa | 60-180 min | 6 meses |
| **Cirurgia** | Extração, cirurgias | 30-90 min | 7 dias |
| **Clareamento** | Consulta + moldeira | 30-60 min | - |

---

## 3. Terminologia Técnica

### 3.1 Glossário Odontológico

| Termo | Definição |
|-------|-----------|
| **Anamnese** | Coleta de história médica e dental do paciente |
| **Odontograma** | Representação gráfica da dentição com condições de cada dente |
| **Cárie** | Doença que causa desmineralização do dente |
| **Periodontite** | Inflamação dos tecidos de suporte do dente |
| **Endodontia** | Tratamento de canal (polpa dentária) |
| **Exodontia** | Extração dentária |
| **Prótese** | Substituição artificial de dentes |
| **Implante** | Parafuso de titânio no osso para suportar prótese |
| **Obturação** | Restauração de cárie com material |
| **Profidaxia** | Limpeza profissional dos dentes |
| **Radiografia periapical** | Raio-X de dente específico |
| **Radiografia panorâmica** | Raio-X de toda arcada |

### 3.2 Terminologia de Gestão Clínica

| Termo | Definição |
|-------|-----------|
| **No-show** | Paciente que não comparece à consulta agendada |
| **Overbooking** | Agendamento acima da capacidade (indesejado) |
| **Underbooking** | Horários vagos não preenchidos |
| **Lead time** | Tempo entre primeiro contato e consulta |
| **LTV (Lifetime Value)** | Valor total que um paciente gera ao longo do tempo |
| **Churn** | Taxa de pacientes que deixam de frequentar |
| **Recall** | Retorno periódico para manutenção |
| **Follow-up** | Acompanhamento pós-procedimento |

### 3.3 Siglas Comuns

| Sigla | Significado |
|-------|-------------|
| **CFM** | Conselho Federal de Medicina |
| **CFO** | Conselho Federal de Odontologia |
| **ANS** | Agência Nacional de Saúde Suplementar |
| **LGPD** | Lei Geral de Proteção de Dados |
| **HIPAA** | Health Insurance Portability (EUA) |
| **PMS** | Practice Management System |
| **EHR** | Electronic Health Record |
| **CRM** | Customer Relationship Management |

---

## 4. Sistema de Saúde Brasileiro

### 4.1 Tipos de Atendimento

| Tipo | Características | Exemplos |
|------|-----------------|----------|
| **Particular** | Pagamento direto, sem intermediários | Consulta avulsa, procedimentos |
| **Convênio** | Plano de saúde, regras específicas | Unimed, Bradesco Saúde, Amil |
| **SUS** | Sistema público, gratuito | UBS, hospitais públicos |

### 4.2 Principais Convênios Odontológicos

| Convênio | Características |
|----------|-----------------|
| **Unimed Odonto** | Rede própria e credenciada |
| **Amil Dental** | Amplo credenciamento |
| **Bradesco Dental** | Cobertura variada |
| **SulAmérica Dental** | Planos corporativos e individuais |
| **OdontoCompany** | Franquia com credenciamento |
| **Dental Uni** | Planos populares |

### 4.3 Fluxo com Convênios

```
1. Verificar se paciente tem convênio
2. Verificar se clínica é credenciada
3. Verificar cobertura do procedimento
4. Solicitar autorização (quando necessário)
5. Realizar procedimento
6. Emitir guia de atendimento
7. Enviar para faturamento
8. Acompanhar pagamento
```

---

## 5. Padrões de Dados

### 5.1 Dados do Paciente

```typescript
interface Patient {
  // Identificação
  id: string;
  clinic_id: string;

  // Dados pessoais
  name: string;
  birth_date: Date;
  cpf?: string;           // Opcional, sensível
  rg?: string;
  gender: 'M' | 'F' | 'O';

  // Contato
  phone: string;          // Principal
  phone_secondary?: string;
  email?: string;
  whatsapp_id?: string;   // ID do WhatsApp

  // Endereço
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip_code: string;
  };

  // Saúde
  medical_history?: {
    allergies: string[];
    medications: string[];
    conditions: string[];
    observations: string;
  };

  // Dental
  dental_history?: {
    last_visit?: Date;
    current_treatments: string[];
    pending_treatments: string[];
  };

  // Convênio
  insurance?: {
    name: string;
    plan: string;
    card_number: string;
    valid_until: Date;
  };

  // Metadados
  created_at: Date;
  updated_at: Date;
  active: boolean;
  tags: string[];
}
```

### 5.2 Dados de Agendamento

```typescript
interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;

  // Agendamento
  datetime: Date;
  duration_minutes: number;

  // Procedimento
  procedure?: {
    name: string;
    code?: string;         // Código de convênio
    value?: number;
  };

  // Status
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

  // Confirmação
  confirmation?: {
    confirmed_at?: Date;
    confirmed_via?: 'whatsapp' | 'phone' | 'app' | 'manual';
    reminder_24h_sent: boolean;
    reminder_2h_sent: boolean;
  };

  // Observações
  notes?: string;
  cancellation_reason?: string;

  // Metadados
  created_at: Date;
  updated_at: Date;
  created_by: string;
}
```

---

## 6. Boas Práticas

### 6.1 Comunicação com Pacientes

| Situação | Boas Práticas |
|----------|---------------|
| **Primeiro contato** | Cumprimentar, identificar clínica, perguntar como pode ajudar |
| **Agendamento** | Confirmar dados, oferecer opções, enviar confirmação escrita |
| **Lembrete** | Ser educado, incluir data/hora/local, oferecer reagendamento |
| **Follow-up** | Perguntar como está, oferecer ajuda, não ser invasivo |
| **Reativação** | Ser cordial, oferecer benefício, não cobrar |

### 6.2 Mensagens Modelo

**Confirmação de Agendamento:**
```
Olá [Nome]! 👋

Sua consulta está agendada:
📅 Data: [data]
⏰ Horário: [horário]
👨‍⚕️ Profissional: Dr(a). [nome]
📍 Local: [endereço]

Confirmar presença? Responda SIM ou solicite reagendamento.
```

**Lembrete 24h:**
```
Oi [Nome]!

Amanhã você tem consulta:
📅 [data] às [horário]
👨‍⚕️ Dr(a). [nome]

Confirma? Responda SIM 👍
Precisa remarcar? Me avise!
```

**Lembrete 2h:**
```
Oi [Nome]! Te esperamos em 2 horas! 🦷

📍 [endereço]
📞 Dúvidas? [telefone]
```

**Follow-up Pós-Consulta:**
```
Oi [Nome]!

Como foi sua experiência hoje?
Avalie de 1 a 5 ⭐

Sua opinião é muito importante para nós! 😊
```

---

## 7. Exemplos de Diálogo Agente-Paciente (Arquitetura 4+1)

### 7.0 Arquitetura Multi-Agente

```
┌─────────────────────────────────────────────────────────────────────┐
│  ARQUITETURA 4+1 - LAZY ACTIVATION                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 ORCHESTRATOR (sempre ativo)                  │    │
│  │                                                              │    │
│  │  • Coordena todos os agentes                                 │    │
│  │  • Gerencia estado da sessão                                 │    │
│  │  • Decide quando escalar para humano                         │    │
│  │  • Monitora qualidade e performance                          │    │
│  └──────────────────────────────┬──────────────────────────────┘    │
│                                 │                                    │
│  ┌──────────────────────────────▼──────────────────────────────┐    │
│  │                    ROUTER (sempre ativo)                     │    │
│  │                                                              │    │
│  │  • Classifica intenção (confidence score)                    │    │
│  │  • Se confidence >= 0.8 → Resolve diretamente               │    │
│  │  • Se confidence < 0.8 → Delega para especialista           │    │
│  │  • Identifica paciente e carrega contexto                   │    │
│  └──────────────────────────────┬──────────────────────────────┘    │
│                                 │                                    │
│        ┌────────────────────────┼────────────────────────┐          │
│        │                        │                        │          │
│        ▼                        ▼                        ▼          │
│  ┌───────────┐          ┌───────────┐          ┌───────────┐       │
│  │ SCHEDULER │          │   SALES   │          │GENERALIST │       │
│  │  (lazy)   │          │  (lazy)   │          │   (lazy)  │       │
│  ├───────────┤          ├───────────┤          ├───────────┤       │
│  │Agendamento│          │Vendas     │          │FAQs       │       │
│  │Reagendam. │          │Orçamentos │          │Informações│       │
│  │Cancelam.  │          │Promoções  │          │Geral      │       │
│  │Lembretes  │          │Conversão  │          │           │       │
│  └───────────┘          └───────────┘          └───────────┘       │
│                                                                      │
│  LAZY ACTIVATION: Especialistas só são invocados quando necessário  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.1 Cenário: Agendamento de Nova Consulta (Router → Scheduler)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO 1: AGENDAMENTO COM LAZY ACTIVATION                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Paciente: Oi, gostaria de agendar uma consulta                     │
│                                                                      │
│  [ROUTER - Análise]                                                  │
│  ├── Intenção detectada: SCHEDULING                                 │
│  ├── Confidence score: 0.92 (alto)                                  │
│  ├── Decisão: Delegar para Scheduler Agent                          │
│  └── Contexto carregado: Paciente novo (sem histórico)              │
│                                                                      │
│  [SCHEDULER AGENT ativado]                                          │
│                                                                      │
│  Agente: Olá! 👋 Seja bem-vindo à Clínica Sorriso!                  │
│                                                                      │
│          Para te ajudar melhor, é sua primeira vez conosco?         │
│                                                                      │
│  Paciente: Sim, é minha primeira vez                                │
│                                                                      │
│  Agente: Que legal! Vou te ajudar.                                  │
│                                                                      │
│          Qual procedimento você gostaria de fazer?                  │
│          1️⃣ Consulta de avaliação                                   │
│          2️⃣ Limpeza                                                 │
│          3️⃣ Clareamento                                             │
│          4️⃣ Outro                                                   │
│                                                                      │
│  Paciente: Consulta de avaliação                                    │
│                                                                      │
│  Agente: Perfeito! Qual profissional você prefere?                  │
│          👨‍⚕️ Dr. Roberto - Generalista                              │
│          👩‍⚕️ Dra. Ana - Especialista em estética                    │
│                                                                      │
│  Paciente: Dr. Roberto                                              │
│                                                                      │
│  Agente: Ótima escolha! Tenho horários disponíveis:                 │
│                                                                      │
│          📅 Terça-feira, 18/03                                      │
│             ⏰ 09:00 ou 14:00                                        │
│                                                                      │
│          📅 Quarta-feira, 19/03                                     │
│             ⏰ 10:00 ou 15:30                                        │
│                                                                      │
│          Qual funciona melhor pra você?                             │
│                                                                      │
│  Paciente: Terça às 14:00                                           │
│                                                                      │
│  [AÇÃO: Criar agendamento - Risco BAIXO (auto-executar)]            │
│                                                                      │
│  Agente: ✅ Agendado!                                                │
│                                                                      │
│          📋 Resumo:                                                  │
│          📅 Terça, 18/03 às 14:00                                   │
│          👨‍⚕️ Dr. Roberto                                             │
│          📍 Rua das Flores, 123                                     │
│                                                                      │
│          Para confirmar, preciso do seu nome completo e telefone.   │
│                                                                      │
│  Paciente: João Silva, 11999887766                                  │
│                                                                      │
│  Agente: Prontinho, João! Sua consulta está confirmada! 🎉          │
│                                                                      │
│          Vou te lembrar 24h antes e 2h antes.                       │
│          Precisa de algo mais?                                      │
│                                                                      │
│  [SCHEDULER retorna controle para ROUTER]                           │
│                                                                      │
│  Paciente: Não, obrigado!                                           │
│                                                                      │
│  Agente: Perfeito! Te espero terça! 😊                              │
│          Se tiver dúvidas, é só chamar.                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Cenário: Reagendamento com Confirmação de Risco Médio

```
┌─────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO 2: REAGENDAMENTO COM NÍVEL DE RISCO MÉDIO                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Paciente: Preciso remarcar minha consulta de amanhã                │
│                                                                      │
│  [ROUTER - Análise]                                                  │
│  ├── Intenção: RESCHEDULE                                           │
│  ├── Confidence: 0.95                                               │
│  ├── Contexto: Maria Silva, consulta Dra. Ana amanhã 10h           │
│  └── Delegar para Scheduler                                         │
│                                                                      │
│  [SCHEDULER AGENT - Lembra contexto do paciente (L2 Memory)]        │
│                                                                      │
│  Agente: Oi Maria! Tudo bem?                                        │
│                                                                      │
│          Vi que sua consulta é com a Dra. Ana amanhã às 10h.        │
│          Aconteceu algo?                                            │
│                                                                      │
│  Paciente: Sim, tenho uma reunião no trabalho                       │
│                                                                      │
│  Agente: Entendo! Sem problemas, vamos remarcar.                    │
│                                                                      │
│          A Dra. Ana tem esses horários disponíveis:                 │
│                                                                      │
│          📅 Quinta, 20/03 às 09:00                                  │
│          📅 Sexta, 21/03 às 14:00                                   │
│          📅 Segunda, 24/03 às 11:00                                 │
│                                                                      │
│          Qual funciona melhor?                                      │
│                                                                      │
│  Paciente: Sexta às 14:00                                           │
│                                                                      │
│  [AÇÃO: Cancelar agendamento antigo + Criar novo]                   │
│  [RISCO: MÉDIO (31-60) → Requer confirmação simples]                │
│                                                                      │
│  Agente: Vou remarcar sua consulta. Confirma?                       │
│                                                                      │
│          ❌ Cancelar: Terça, 18/03 às 10:00                         │
│          ✅ Novo: Sexta, 21/03 às 14:00                             │
│                                                                      │
│          Responda SIM para confirmar.                               │
│                                                                      │
│  Paciente: Sim                                                      │
│                                                                      │
│  [AÇÃO EXECUTADA - Undo disponível por 5 minutos]                   │
│                                                                      │
│  Agente: ✅ Remarcado!                                               │
│                                                                      │
│          Sua consulta agora é:                                      │
│          📅 Sexta, 21/03 às 14:00                                   │
│          👩‍⚕️ Dra. Ana                                                │
│                                                                      │
│          Vou atualizar os lembretes. Alguma dúvida?                 │
│                                                                      │
│  Paciente: Perfeito, obrigada!                                      │
│                                                                      │
│  Agente: Por nada, Maria! Até sexta! 😊                             │
│                                                                      │
│  [SCHEDULER → ROUTER → Memória L2 atualizada]                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Cenário: Dúvida sobre Procedimento (Router → Sales Agent)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO 3: INFORMAÇÃO MÉDICA → VENDAS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Paciente: Quanto custa um clareamento?                             │
│                                                                      │
│  [ROUTER - Análise]                                                  │
│  ├── Intenção: PRICING_INQUIRY                                      │
│  ├── Confidence: 0.75 (médio-alto)                                  │
│  ├── Sub-intenção detectada: Potential sales opportunity            │
│  └── Delegar para Sales Agent (lazy activation)                     │
│                                                                      │
│  [SALES AGENT ativado - Personalidade: Odonto Formal]               │
│                                                                      │
│  Agente: Oi! Claro, vou te passar os valores:                       │
│                                                                      │
│          🦷 Clareamento Caseiro: R$ 350,00                          │
│             • Moldeira personalizada                                │
│             • Gel para usar em casa por 14 dias                     │
│                                                                      │
│          🦷 Clareamento a Laser: R$ 800,00                          │
│             • Sessão de 1h no consultório                           │
│             • Resultado imediato                                    │
│                                                                      │
│          🦷 Combo (Laser + Caseiro): R$ 1.000,00                    │
│             • Melhor resultado e manutenção                         │
│                                                                      │
│          Aceitamos cartão em até 3x sem juros! 💳                   │
│                                                                      │
│          Quer agendar uma avaliação?                                │
│                                                                      │
│  Paciente: O combo parece interessante. Tem contra-indicação?       │
│                                                                      │
│  [SALES consulta RAG (L5 - Knowledge Base)]                         │
│                                                                      │
│  Agente: Ótima pergunta! O clareamento não é recomendado para:      │
│                                                                      │
│          ⚠️ Gestantes                                                │
│          ⚠️ Pessoas com gengivite avançada                          │
│          ⚠️ Dentes com cárie não tratada                            │
│          ⚠️ Menores de 15 anos                                      │
│                                                                      │
│          Na avaliação, o dentista verifica tudo isso.               │
│          Quer agendar? A avaliação é grátis!                        │
│                                                                      │
│  Paciente: Sim, quero agendar!                                      │
│                                                                      │
│  [SALES → ROUTER → SCHEDULER]                                       │
│  [Transição de agentes registrada na memória L1]                    │
│                                                                      │
│  Agente: [Prossegue com agendamento...]                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.4 Cenário: No-Show e Recuperação (Trigger Automático)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO 4: RECUPERAÇÃO DE NO-SHOW (TRIGGER INTELIGENTE)           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [TRIGGER: No-Show detectado - 1h após horário]                     │
│  ├── Prioridade: Alta                                               │
│  ├── Cooldown: 24h antes de próxima mensagem                        │
│  └── Ação: Enviar mensagem de recuperação                           │
│                                                                      │
│  [SCHEDULER AGENT - Trigger automático]                             │
│                                                                      │
│  Agente: Oi Pedro! Tudo bem?                                        │
│                                                                      │
│          Notei que você não conseguiu comparecer hoje às 14h.       │
│          Espero que esteja tudo bem!                                │
│                                                                      │
│          Quer remarcar? Tenho horários amanhã e depois.             │
│                                                                      │
│  Paciente: (Não responde)                                           │
│                                                                      │
│  [TRIGGER: Follow-up 24h depois - Merged com trigger anterior]      │
│  ├── Evitar spam: mensagens combinadas                              │
│  └── Oferecer opções concretas                                      │
│                                                                      │
│  Agente: Pedro, ainda tenho horários disponíveis:                   │
│                                                                      │
│          📅 Quinta às 10:00                                         │
│          📅 Sexta às 15:00                                          │
│                                                                      │
│          Me avise se algum funciona! 👋                              │
│                                                                      │
│  Paciente: Poxa, desculpa! Esqueci completamente. Quinta serve.     │
│                                                                      │
│  [AÇÃO: Reagendamento - Risco BAIXO]                                │
│  [Memória L4 atualizada: Score de risco do paciente]                │
│                                                                      │
│  Agente: Sem problemas, Pedro! Acontece! 😊                         │
│                                                                      │
│          ✅ Agendado para quinta, 20/03 às 10:00                    │
│          👨‍⚕️ Dr. Roberto                                             │
│                                                                      │
│          Vou te lembrar 24h antes!                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.5 Cenário: Follow-up Pós-Procedimento (Ação de Alto Risco)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO 5: FOLLOW-UP PÓS-TRATAMENTO                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [TRIGGER: 1 dia após procedimento de canal]                        │
│  ├── Tipo: Follow-up pós-tratamento                                 │
│  ├── Prioridade: Alta                                               │
│  └── Template: Follow-up Canal                                      │
│                                                                      │
│  [SCHEDULER AGENT - Personalidade: Odonto Formal]                   │
│                                                                      │
│  Agente: Oi Ana! Como você está se sentindo?                        │
│                                                                      │
│          Você fez tratamento de canal ontem com a Dra. Ana.         │
│          É normal sentir um pouco de desconforto nas primeiras      │
│          48h.                                                       │
│                                                                      │
│          📋 Cuidados importantes:                                   │
│          • Evite alimentos muito quentes ou frios                   │
│          • Tome o remédio prescrito                                 │
│          • Se tiver dor forte, me avise!                            │
│                                                                      │
│          Como está a dor hoje?                                      │
│          1️⃣ Nenhuma dor                                             │
│          2️⃣ Leve desconforto                                        │
│          3️⃣ Dor moderada                                            │
│          4️⃣ Dor forte                                               │
│                                                                      │
│  Paciente: 2, leve desconforto                                      │
│                                                                      │
│  Agente: Isso é normal, Ana! 👍                                     │
│                                                                      │
│          O desconforto deve melhorar em 2-3 dias.                   │
│          Continue tomando o remédio se precisar.                    │
│                                                                      │
│          Sua consulta de retorno está agendada para:                │
│          📅 28/03 às 14:00                                          │
│                                                                      │
│          Precisa de algo mais?                                      │
│                                                                      │
│  Paciente: Não, obrigada!                                           │
│                                                                      │
│  Agente: Perfeito! Qualquer coisa, é só chamar. 😊                  │
│          Te espero no dia 28!                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.6 Cenário: Ação de Alto Risco (Cancelamento com Reembolso)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DIÁLOGO 6: AÇÃO DE ALTO RISCO - DUPLA CONFIRMAÇÃO                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Paciente: Quero cancelar minha consulta de amanhã e pedir reembolso│
│                                                                      │
│  [ROUTER - Análise]                                                  │
│  ├── Intenção: CANCEL_WITH_REFUND                                   │
│  ├── Confidence: 0.88                                               │
│  ├── Risco detectado: ALTO (61-100)                                 │
│  │   ├── Envolva reembolso financeiro                               │
│  │   ├── Política de cancelamento pode aplicar                      │
│  │   └── Potencial perda de receita                                 │
│  └── Delegar para Scheduler com flag HIGH_RISK                      │
│                                                                      │
│  [SCHEDULER AGENT - Modo cauteloso]                                 │
│                                                                      │
│  Agente: Entendo, Carlos. Vou te ajudar com o cancelamento.         │
│                                                                      │
│          ⚠️ Antes de prosseguir, preciso confirmar:                 │
│                                                                      │
│          Consulta: Terça, 18/03 às 14:00 com Dr. Roberto            │
│          Valor pago: R$ 200,00                                      │
│                                                                      │
│          📋 Política de cancelamento:                               │
│          • Cancelamento com mais de 24h: reembolso integral         │
│          • Cancelamento com menos de 24h: taxa de 20%               │
│                                                                      │
│          Como sua consulta é amanhã, aplica-se a taxa.              │
│          Valor a reembolsar: R$ 160,00                              │
│                                                                      │
│          Confirma o cancelamento? Responda SIM para continuar.      │
│                                                                      │
│  Paciente: Sim, confirmo                                            │
│                                                                      │
│  [AÇÃO: Cancelar + Reembolso - Risco ALTO (61-100)]                 │
│  [Requer DUPLA CONFIRMAÇÃO]                                         │
│                                                                      │
│  Agente: Para sua segurança, confirme novamente:                    │
│                                                                      │
│          ⏪ Esta ação não pode ser desfeita automaticamente         │
│          💰 Reembolso de R$ 160,00 será processado em 3-5 dias     │
│                                                                      │
│          Digite CONFIRMAR para prosseguir.                          │
│                                                                      │
│  Paciente: CONFIRMAR                                                │
│                                                                      │
│  [AÇÃO EXECUTADA]                                                    │
│  [Notificação enviada para clínica]                                 │
│  [Log de decisão registrado com reasoning]                          │
│                                                                      │
│  Agente: ✅ Cancelamento confirmado!                                 │
│                                                                      │
│          Seu reembolso de R$ 160,00 será processado.               │
│          Você receberá um email de confirmação.                     │
│                                                                      │
│          Esperamos ver você novamente! 😊                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.7 Personalidade Templates em Ação

```
┌─────────────────────────────────────────────────────────────────────┐
│  COMPARATIVO: PERSONALIDADE TEMPLATES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Cena: Paciente pergunta sobre clareamento                          │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  TEMPLATE: ODONTO FORMAL                                            │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Agente: Prezado(a), nossos tratamentos de clareamento dental       │
│          oferecem resultados excepcionais.                          │
│                                                                      │
│          Opções disponíveis:                                        │
│          • Clareamento Caseiro: R$ 350,00                           │
│          • Clareamento a Laser: R$ 800,00                           │
│          • Combo Completo: R$ 1.000,00                              │
│                                                                      │
│          Gostaria de agendar uma avaliação para verificar            │
│          adequação ao seu caso?                                     │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  TEMPLATE: ESTÉTICA ACOLEDORA                                       │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Agente: Oiê! Que bom ter você aqui! 💕                             │
│                                                                      │
│          Sabe aquele sorriso dos sonhos? A gente te ajuda a         │
│          conquistar! ✨                                             │
│                                                                      │
│          Temos opções super especiais:                              │
│          ✨ Clareamento em casa: R$ 350,00 - super prático!         │
│          ✨ Clareamento express: R$ 800,00 - resultado na hora!     │
│          ✨ Combo completo: R$ 1.000,00 - o mais queridinho!        │
│                                                                      │
│          Bora agendar um chatinho para conhecer você melhor?        │
│          É sem compromisso, viu? 🥰                                  │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  TEMPLATE: FISIO PRÁTICA                                            │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  Agente: Oi! Temos clareamento disponível.                          │
│                                                                      │
│          Valores:                                                    │
│          • Caseiro: R$ 350 (14 dias de uso)                         │
│          • Laser: R$ 800 (1h no consultório)                        │
│          • Combo: R$ 1.000 (melhor custo-benefício)                 │
│                                                                      │
│          Tem interesse? Me passa sua disponibilidade que agendamos. │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Tratamento de Dados Sensíveis

```typescript
// Checklist de conformidade
const dataHandlingChecklist = {
  coleta: [
    'Apenas dados necessários',
    'Consentimento explícito para dados de saúde',
    'Informar finalidade do tratamento'
  ],
  armazenamento: [
    'Criptografia em repouso (AES-256)',
    'Isolamento por clínica (RLS)',
    'Backup criptografado',
    'Log de acessos'
  ],
  processamento: [
    'Minimização de dados',
    'Acesso apenas quando necessário',
    'Log de todas operações'
  ],
  compartilhamento: [
    'Apenas com autorização',
    'Contratos de processador de dados',
    'Registro de transferências'
  ],
  retencao: [
    'Prazo definido por regulamento',
    'Política de retenção documentada',
    'Processo de eliminação seguro'
  ]
};
```

---

## 7. Integrações Externas

### 7.1 Sistemas de Gestão (PMS)

| Sistema | API | Tipo | Integração |
|---------|-----|------|------------|
| **Doctoralia** | REST | SaaS | Webhooks, APIs |
| **Feegow** | REST | SaaS | APIs limitadas |
| **DrConecta** | REST | SaaS | APIs limitadas |
| **SimDental** | SOAP/REST | Desktop | Integração local |

### 7.2 Padrões de Interoperabilidade

| Padrão | Uso | Relevância |
|--------|-----|------------|
| **HL7 FHIR** | Troca de dados de saúde | Alta - futuro |
| **HL7 CDA** | Documentos clínicos | Média |
| **DICOM** | Imagens médicas | Baixa - radiografias |
| **OpenAPI** | APIs REST | Alta - documentação |

---

## 8. Casos de Uso por Especialidade

### 8.1 Ortodontia

**Características:**
- Tratamento de longa duração (1-3 anos)
- Visitas frequentes (mensais)
- Alto ticket médio
- Recall crítico

**Necessidades de IA:**
- Lembretes de ajuste mensal
- Follow-up de elásticos/aparelhos
- Campanhas de finalização de tratamento
- Reativação de pacientes que abandonaram

### 8.2 Implantodontia

**Características:**
- Procedimentos de alto valor
- Múltiplas etapas
- Follow-up pós-cirúrgico crítico

**Necessidades de IA:**
- Orientações pós-operatórias
- Agendamento de etapas
- Lembretes de manutenção
- Follow-up de osseointegração

### 8.3 Odontologia Estética

**Características:**
- Procedimentos eletivos
- Marketing-driven
- Pacientes exigentes

**Necessidades de IA:**
- Campanhas de captação
- Follow-up de orçamentos
- Antes/depois (consentimento)
- Marketing de conteúdo

---

## 9. Métricas de Referência

### 9.1 KPIs Operacionais

| Métrica | Benchmark | Meta |
|---------|-----------|------|
| **Taxa de no-show** | 20-30% | <15% |
| **Tempo de resposta lead** | 4-8h | <5min |
| **Taxa de confirmação** | 50-60% | >85% |
| **Pacientes reativados/mês** | 0-2 | 10-20 |
| **NPS** | 30-50 | >60 |

### 9.2 KPIs Financeiros

| Métrica | Cálculo | Referência |
|---------|---------|------------|
| **Ticket médio** | Receita / Consultas | R$150-400 |
| **LTV paciente** | Receita total do paciente | R$2.000-10.000 |
| **CAC** | Custo marketing / Novos pacientes | R$50-200 |
| **Receita perdida no-show** | Consultas não comparecidas × Ticket | R$5-15k/mês |

---

## 10. Referências

- [CFO - Conselho Federal de Odontologia](https://cfo.org.br)
- [CFM - Conselho Federal de Medicina](https://portal.cfm.org.br)
- [ANVISA - Agência Nacional de Vigilância Sanitária](https://www.gov.br/anvisa)
- [LGPD - Lei 13.709/2018](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [HL7 FHIR - Saúde Interoperabilidade](https://www.hl7.org/fhir/)
- [ANS - Agência Nacional de Saúde Suplementar](https://www.ans.gov.br)