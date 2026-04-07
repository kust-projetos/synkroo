# Synkroo Configurações UX Design Specification

**Version:** 1.0
**Date:** March 26, 2026
**Status:** Draft
**Author:** UX Design Team (BMAD)

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [User Personas](#2-user-personas)
3. [Information Architecture](#3-information-architecture)
4. [Layout & Components](#4-layout--components)
5. [Interaction Patterns](#5-interaction-patterns)
6. [States & Variations](#6-states--variations)
7. [Accessibility Guidelines](#7-accessibility-guidelines)
8. [Mobile Responsiveness](#8-mobile-responsiveness)
9. [API Integration](#9-api-integration)

---

## 1. Overview & Goals

### 1.1 Purpose

A tela de **Configurações** centraliza todas as definições do sistema: personalidade do agente, horários de funcionamento, equipe, assinatura e preferências gerais. É o painel de controle da operação.

### 1.2 Primary Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| **Organização** | Encontrar configuração em < 10 segundos | High |
| **Treino do Agente** | Personalizar comportamento facilmente | Critical |
| **Segurança** | Gerenciar acessos com clareza | High |
| **Assinatura** | Entender plano e limites | Medium |
| **Backup** | Exportar/backup de dados | Low |

### 1.3 Settings Categories

| Categoria | Sub-itens |
|-----------|-----------|
| **Agente** | Personalidade, tom, ações automáticas |
| **Horários** | Funcionamento, bloqueios, exceções |
| **Equipe** | Usuários, permissões, convites |
| **Clínica** | Dados, endereço, contato |
| **Assinatura** | Plano, tokens, faturamento |
| **Integrações** | Conexões externas |
| **Segurança** | Senha, 2FA, logs |
| **Notificações** | Alertas, emails |

---

## 2. User Personas

### 2.1 Primary: Dr. Ana Santos (Dentista)

**Cenários de uso:**

| Cenário | Frequência | Ação Principal |
|---------|------------|----------------|
| Treinar agente | 1x/semana | Ajustar personalidade |
| Horários | 1x/mês | Atualizar funcionamento |
| Equipe | Ocasional | Adicionar/remover usuário |
| Assinatura | 1x/mês | Ver consumo de tokens |

### 2.2 Pain Points Addressed

- "Quero que o agente fale de um jeito mais formal"
- "Preciso ajustar os horários de funcionamento"
- "Quero adicionar um novo dentista ao sistema"

---

## 3. Information Architecture

### 3.1 Screen Structure

```
Configurações
├── Sidebar (Navegação)
│   ├── Agente
│   ├── Horários
│   ├── Equipe
│   ├── Clínica
│   ├── Assinatura
│   ├── Integrações
│   ├── Segurança
│   └── Notificações
│
├── Main Content
│   └── [Seção selecionada]
│
└── Header
    ├── Busca
    └── Ajuda
```

---

## 4. Layout & Components

### 4.1 Desktop Layout (1440px+)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  CONFIGURAÇÕES                                       🔍 Buscar    [?]     │
├────────────────────────────────────────────────────────────────────────────┤
│                                    │                                       │
│  AGENTE                            │   PERSONALIDADE DO AGENTE             │
│  ┌─────────────────────────────┐   │   ┌───────────────────────────────┐  │
│  │ > Personalidade             │   │   │                               │  │
│  │   Tom e estilo              │   │   │ Template: [Odonto Formal ▼]   │  │
│  │   Ações automáticas         │   │   │                               │  │
│  └─────────────────────────────┘   │   │ PREVIEW DA RESPOSTA           │  │
│                                    │   │ ─────────────────────────────  │  │
│  HORÁRIOS                          │   │                               │  │
│  ┌─────────────────────────────┐   │   │ "Olá! Bem-vindo à Clínica     │  │
│  │   Funcionamento             │   │   │ Odonto Sorriso. Como posso    │  │
│  │   Bloqueios                 │   │   │ ajudá-lo hoje?"               │  │
│  └─────────────────────────────┘   │   │                               │  │
│                                    │   │ TOM                            │  │
│  EQUIPE                            │   │ ─────────────────────────────  │  │
│  ┌─────────────────────────────┐   │   │                               │  │
│  │   Usuários                  │   │   │ Formalidade:  ●────────○      │  │
│  │   Permissões                │   │   │   [Formal]      [Casual]      │  │
│  │   Convites                  │   │   │                               │  │
│  └─────────────────────────────┘   │   │ Empatia:     ─●───────○      │  │
│                                    │   │   [Técnico]     [Acolhedor]   │  │
│  CLÍNICA                           │   │                               │  │
│  ┌─────────────────────────────┐   │   │ Proatividade: ────●─────○    │  │
│  │   Dados                     │   │   │   [Reativo]     [Proativo]   │  │
│  │   Endereço                  │   │   │                               │  │
│  └─────────────────────────────┘   │   │ FRASES PERSONALIZADAS        │  │
│                                    │   │ ─────────────────────────────  │  │
│  ASSINATURA                        │   │                               │  │
│  ┌─────────────────────────────┐   │   │ Saudação inicial:             │  │
│  │ > Plano atual               │   │   │ [Olá! Como posso ajudar?]     │  │
│  │   Tokens                    │   │   │                               │  │
│  │   Faturamento               │   │   │ Despedida:                    │  │
│  └─────────────────────────────┘   │   │ [Até logo! Cuide-se!]         │  │
│                                    │   │                               │  │
│  ...                               │   │ [Salvar alterações]            │  │
│                                    │   │                               │  │
│                                    │   └───────────────────────────────┘  │
│                                    │                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Settings Section: Horários

```
┌───────────────────────────────────────────────────────────────────────────┐
│  HORÁRIOS DE FUNCIONAMENTO                                                 │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Dia         Abertura    Fechamento    Intervalo      Status        │  │
│  │ ───────────────────────────────────────────────────────────────────│  │
│  │ Segunda     08:00       18:00         12:00-13:00   [✓ Ativo]     │  │
│  │ Terça       08:00       18:00         12:00-13:00   [✓ Ativo]     │  │
│  │ Quarta      08:00       18:00         12:00-13:00   [✓ Ativo]     │  │
│  │ Quinta      08:00       20:00         12:00-13:00   [✓ Ativo]     │  │
│  │ Sexta       08:00       16:00         --            [✓ Ativo]     │  │
│  │ Sábado      08:00       12:00         --            [○ Inativo]   │  │
│  │ Domingo     --          --            --            [○ Inativo]   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  BLOQUEIOS FUTUROS                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Data         Motivo                  Profissionais       Ações     │  │
│  │ ───────────────────────────────────────────────────────────────────│  │
│  │ 15/04        Feriado                 Todos              [✕]       │  │
│  │ 20-22/04     Congresso               Dr. Ana             [✕]       │  │
│  │ [+ Adicionar bloqueio]                                               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  [Salvar alterações]                                                      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Settings Section: Equipe

```
┌───────────────────────────────────────────────────────────────────────────┐
│  EQUIPE                                                                    │
│                                                                           │
│  USUÁRIOS ATIVOS                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Nome              Email                   Função         Status    │  │
│  │ ───────────────────────────────────────────────────────────────────│  │
│  │ Dr. Ana Santos    ana@odontosorriso.com   Admin         ● Ativo   │  │
│  │ Dr. Paulo Canal   paulo@odontosorriso.com Dentista      ● Ativo   │  │
│  │ Maria Atendente   maria@odontosorriso.com Atendente     ● Ativo   │  │
│  │ Dr. Carlos        carlos@...             Dentista      ○ Pendente │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  CONVITES PENDENTES                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Email                   Função        Enviado em      Ações        │  │
│  │ ───────────────────────────────────────────────────────────────────│  │
│  │ carlos@...             Dentista      24/03/2026      [Reenviar]  │  │
│  │ [+ Convidar membro]                                                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  NÍVEIS DE ACESSO                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Função        Dashboard  Conversas  Agenda  Pacientes  Config     │  │
│  │ ───────────────────────────────────────────────────────────────────│  │
│  │ Admin         ✓          ✓         ✓       ✓         ✓          │  │
│  │ Dentista      ✓          ✓         ✓       ✓         ✕          │  │
│  │ Atendente     ✓          ✓         ✓       ✓         ✕          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Settings Section: Assinatura

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ASSINATURA                                                                │
│                                                                           │
│  PLANO ATUAL                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        GROWTH                                       │  │
│  │                                                                     │  │
│  │  R$ 1.150/mês                                                       │  │
│  │                                                                     │  │
│  │  ✓ Até 5 profissionais                                             │  │
│  │  ✓ WhatsApp + Instagram + Chat Widget                              │  │
│  │  ✓ Relatórios avançados                                            │  │
│  │  ✓ Suporte prioritário                                             │  │
│  │                                                                     │  │
│  │  [Ver detalhes] [Upgrade para Scale]                               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  CONSUMO DE TOKENS (Março 2026)                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                                                                     │  │
│  │  ████████████████████░░░░░░░░░░░░  67%                              │  │
│  │                                                                     │  │
│  │  12,450 / 18,500 tokens usados                                      │  │
│  │  Previsão de uso até fim do mês: ~16,000 tokens                    │  │
│  │                                                                     │  │
│  │  Custo estimado: R$ 186.75 (repasse)                               │  │
│  │                                                                     │  │
│  │  [Ver detalhes de uso] [Aumentar limite]                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  FATURAMENTO                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Próxima cobrança: 05/04/2026                                       │  │
│  │ Método: Cartão de crédito •••• 4242                                 │  │
│  │ [Ver histórico] [Atualizar método]                                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Component: Personality Slider

```html
<div class="personality-slider">
  <label for="formality-slider" class="personality-slider__label">
    Formalidade
  </label>

  <div class="personality-slider__track">
    <span class="personality-slider__min">Formal</span>
    <input
      type="range"
      id="formality-slider"
      min="0"
      max="100"
      value="70"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="70"
      aria-label="Nível de formalidade: 70% formal"
    />
    <span class="personality-slider__max">Casual</span>
  </div>

  <div class="personality-slider__value">
    <span class="personality-slider__percentage">70%</span>
    <span class="personality-slider__description">Muito formal</span>
  </div>
</div>
```

### 4.6 Component: Template Selector

```html
<div class="template-selector">
  <label for="personality-template" class="template-selector__label">
    Template de Personalidade
  </label>

  <div class="template-selector__dropdown">
    <select id="personality-template">
      <option value="odonto-formal">Odonto Formal</option>
      <option value="odonto-casual">Odonto Casual</option>
      <option value="estetica-acolhedora">Estética Acolhedora</option>
      <option value="fisio-pratica">Fisio Prática</option>
      <option value="custom">Personalizado</option>
    </select>
  </div>

  <div class="template-selector__preview">
    <h4>Preview</h4>
    <p class="template-selector__sample">
      "Olá! Bem-vindo à Clínica Odonto Sorriso. Como posso ajudá-lo hoje?"
    </p>
  </div>
</div>
```

---

## 5. Interaction Patterns

### 5.1 Save Settings

```
1. Usuário altera configuração
   ↓
2. Botão [Salvar] fica destacado
   ↓
3. Clicar em Salvar:
   - Validação client-side
   - POST para API
   - Loading state
   ↓
4. Toast de sucesso:
   "Configurações salvas com sucesso"
   ↓
5. Preview atualizado (se aplicável)
```

### 5.2 Personality Training

```
1. Usuário seleciona template
   ↓
2. Preview em tempo real
   ↓
3. Ajusta sliders:
   - Formalidade
   - Empatia
   - Proatividade
   ↓
4. Digita frases personalizadas
   ↓
5. Testa com simulação:
   ┌────────────────────────────┐
   │ TESTAR RESPOSTA            │
   │                            │
   │ Você: "Quero agendar"      │
   │                            │
   │ Agente: "Olá! Com prazer   │
   │ agendarei sua consulta.    │
   │ Qual procedimento deseja?" │
   │                            │
   │ [Testar novamente]         │
   └────────────────────────────┘
   ↓
6. Salva configuração
```

### 5.3 Invite Team Member

```
1. Clicar [+ Convidar membro]
   ↓
2. Modal de convite:
   ┌────────────────────────────┐
   │ CONVIDAR MEMBRO            │
   │                            │
   │ Email: [                   │
   │ Função: [Dentista ▼]       │
   │                            │
   │ Mensagem (opcional):       │
   │ [                          │
   │                            │
   │ [Cancelar] [Enviar convite]│
   └────────────────────────────┘
   ↓
3. Email enviado
   ↓
4. Toast: "Convite enviado para carlos@email.com"
   ↓
5. Convite aparece em "Pendentes"
```

### 5.4 Export Data

```
1. Usuário vai em Segurança > Backup
   ↓
2. Opções de exportação:
   ┌────────────────────────────┐
   │ EXPORTAR DADOS             │
   │                            │
   │ □ Pacientes                │
   │ □ Agendamentos             │
   │ □ Conversas                │
   │ □ Métricas                 │
   │                            │
   │ Período: [Último ano ▼]    │
   │ Formato: [CSV ▼]           │
   │                            │
   │ [Gerar exportação]         │
   └────────────────────────────┘
   ↓
3. Processamento em background
   ↓
4. Email com link de download
```

---

## 6. States & Variations

### 6.1 Loading Settings

```html
<div class="settings-skeleton">
  <div class="skeleton__nav"></div>
  <div class="skeleton__content">
    <div class="skeleton__title"></div>
    <div class="skeleton__form"></div>
  </div>
</div>
```

### 6.2 Validation Error

```
┌────────────────────────────────────────┐
│                                        │
│  ⚠️ Erro ao salvar configurações       │
│                                        │
│  Horário de fechamento deve ser        │
│  posterior ao horário de abertura.     │
│                                        │
│  [Corrigir]                            │
│                                        │
└────────────────────────────────────────┘
```

### 6.3 Trial Period Warning

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ⚠️ PERÍODO DE TRIAL                                                     │
│                                                                           │
│  Seu período de teste termina em 5 dias.                                 │
│                                                                           │
│  Para continuar usando o Synkroo, adicione um método de pagamento.       │
│                                                                           │
│  [Adicionar pagamento] [Ver planos]                                       │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Accessibility Guidelines

### 7.1 Form Accessibility

```html
<fieldset>
  <legend>Horários de Funcionamento</legend>

  <div class="form-group">
    <label for="monday-open">Segunda - Abertura</label>
    <input
      type="time"
      id="monday-open"
      aria-describedby="monday-open-help"
    />
    <span id="monday-open-help" class="form-help">
      Horário de início do atendimento
    </span>
  </div>
</fieldset>
```

### 7.2 Keyboard Navigation

| Tecla | Ação |
|-------|------|
| `Tab` | Navegar entre campos |
| `↑` `↓` | Navegar entre seções (sidebar) |
| `Enter` | Ativar botão/campo |
| `Escape` | Cancelar edição |

---

## 8. Mobile Responsiveness

### 8.1 Mobile Layout (< 768px)

```
┌─────────────────────────────┐
│  CONFIGURAÇÕES              │
├─────────────────────────────┤
│                             │
│  Selecione uma categoria:   │
│                             │
│  ┌─────────────────────────┐│
│  │ > Agente                ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │   Horários              ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │   Equipe                ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │   Assinatura            ││
│  └─────────────────────────┘│
│  ...                        │
│                             │
└─────────────────────────────┘

Ao selecionar Agente:

┌─────────────────────────────┐
│  ← Voltar                   │
├─────────────────────────────┤
│  PERSONALIDADE DO AGENTE    │
│                             │
│  Template:                  │
│  [Odonto Formal ▼]          │
│                             │
│  FORMALIDADE                │
│  Formal ●────────○ Casual   │
│                             │
│  EMPATIA                    │
│  Técnico ─●───────○ Acolhedor│
│                             │
│  SAUDAÇÃO                   │
│  [Olá! Como posso ajudar?]  │
│                             │
│  [Salvar]                   │
│                             │
└─────────────────────────────┘
```

---

## 9. API Integration

### 9.1 Endpoints Used

| Endpoint | Use Case |
|----------|----------|
| `GET /clinic/settings` | Buscar configurações |
| `PUT /clinic/settings` | Atualizar configurações |
| `GET /users` | Listar equipe |
| `POST /users/invite` | Convidar membro |
| `GET /subscription` | Dados da assinatura |
| `GET /subscription/usage` | Consumo de tokens |

### 9.2 Settings Schema

```typescript
interface ClinicSettings {
  agent: {
    personalityTemplate: string;
    formality: number; // 0-100
    empathy: number;
    proactivity: number;
    customPhrases: {
      greeting: string;
      farewell: string;
    };
  };

  schedule: {
    weekdays: {
      [key: string]: {
        open: string;
        close: string;
        break?: { start: string; end: string };
        active: boolean;
      };
    };
    blocks: Array<{
      date: string;
      reason: string;
      professionals: string[];
    }>;
  };

  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}
```

---

## Next Steps

- [ ] Criar protótipo de personalidade
- [ ] Testar fluxo de convite
- [ ] Validar sliders de personalidade com dentistas
- [ ] Implementar preview em tempo real