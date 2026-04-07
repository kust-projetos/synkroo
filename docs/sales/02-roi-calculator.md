# Calculadora de ROI - Synkroo

**Versão:** 1.0
**Data:** 2026-03-25
**Uso:** Durante reuniões de proposta

---

## Como Usar

1. Preencha os campos em **AMARELO** com os dados do cliente
2. Os campos em **VERDE** são calculados automaticamente
3. Use os resultados para construir a proposta

---

## 1. Dados da Clínica

| Campo | Valor | Como Descobrir |
|-------|-------|----------------|
| **Nome da clínica** | _______________ | Cadastro |
| **Segmento** | _______________ | Odonto/Estética/Fisio/Outro |
| **Profissionais** | _____ | Perguntar na descoberta |
| **Atendentes** | _____ | Perguntar na descoberta |
| **Pacientes ativos** | _____ | Perguntar na descoberta |
| **Consultas/mês** | _____ | Pacientes ativos × Frequência média |
| **Faturamento/mês** | R$ _____ | Perguntar ou estimar |

---

## 2. Análise de Perdas

### 2.1 No-Show

| Campo | Valor | Fórmula |
|-------|-------|---------|
| Taxa de no-show atual | _____% | Perguntar (média mercado: 25-35%) |
| Consultas perdidas/mês | _____ | Consultas/mês × Taxa no-show |
| Ticket médio | R$ _____ | Faturamento ÷ Consultas/mês |
| **Perda mensal no-show** | **R$ _____** | Consultas perdidas × Ticket médio |

**Exemplo:**
```
Consultas/mês: 200
Taxa no-show: 25%
Consultas perdidas: 50
Ticket médio: R$ 150

PERDA = 50 × R$ 150 = R$ 7.500/mês
```

---

### 2.2 Leads Não Convertidos

| Campo | Valor | Fórmula |
|-------|-------|---------|
| Leads que chegam/mês | _____ | Perguntar |
| Tempo médio de resposta | _____h | Perguntar (mercado: 4-8h) |
| Leads perdidos por demora | _____% | Estimar: 40-60% se > 4h |
| Leads não atendidos/mês | _____ | Leads × % perdidos |
| Valor paciente novo | R$ _____ | LTV ÷ Visitas ou perguntar |
| **Perda mensal leads** | **R$ _____** | Leads perdidos × Valor paciente |

**Exemplo:**
```
Leads/mês: 50
% perdidos: 40%
Leads perdidos: 20
Valor paciente novo: R$ 500

PERDA = 20 × R$ 500 = R$ 10.000/mês
```

---

### 2.3 Pacientes Inativos

| Campo | Valor | Fórmula |
|-------|-------|---------|
| Pacientes ativos | _____ | Já preenchido |
| Pacientes inativos | _____ | Perguntar (média: 30-40% da base) |
| % que voltaria com follow-up | _____% | Estimar: 10-20% |
| Pacientes recuperáveis | _____ | Inativos × % retorno |
| Valor médio retorno | R$ _____ | Ticket médio × 2-3 consultas |
| **Valor recuperável/mês** | **R$ _____** | Pacientes recuperáveis × Valor |

**Exemplo:**
```
Pacientes ativos: 150
Pacientes inativos: 60
% retorno: 15%
Pacientes recuperáveis: 9
Valor retorno: R$ 300

VALOR = 9 × R$ 300 = R$ 2.700/mês
```

---

### 2.4 Custo de Atendente

| Campo | Valor | Fórmula |
|-------|-------|---------|
| Salário atendente | R$ _____ | Perguntar (média: R$ 1.500-2.500) |
| Encargos (~40%) | R$ _____ | Salário × 0,4 |
| **Custo total atendente** | **R$ _____** | Salário + Encargos |
| % que pode automatizar | _____% | Estimar: 60-80% |
| **Economia potencial** | **R$ _____** | Custo total × % automação |

**Exemplo:**
```
Salário: R$ 1.800
Encargos: R$ 720
Custo total: R$ 2.520
% automação: 70%

ECONOMIA = R$ 2.520 × 70% = R$ 1.764/mês
```

---

## 3. Resumo de Perdas e Oportunidades

| Item | Valor Mensal |
|------|--------------|
| Perda com no-show | R$ _____ |
| Perda com leads não convertidos | R$ _____ |
| Valor de pacientes recuperáveis | R$ _____ |
| Economia com automação | R$ _____ |
| **TOTAL DE VALOR** | **R$ _____** |

---

## 4. Cálculo de Investimento

### 4.1 Plano Escolhido

| Plano | Setup Fee | Mensalidade |
|-------|-----------|-------------|
| Starter | R$ 3.000-5.000 | R$ 500-800 |
| Growth | R$ 5.000-10.000 | R$ 800-1.500 |
| Scale | R$ 10.000-20.000 | R$ 1.500-3.000 |

**Plano recomendado:** ____________

### 4.2 Features Adicionais

| Feature | Valor Setup |
|---------|-------------|
| Instagram DM | R$ 500 |
| Chat Widget | R$ 300 |
| Multi-profissional | R$ 600 |
| RAG avançado | R$ 800 |
| Follow-up avançado | R$ 400 |
| Métricas avançadas | R$ 400 |
| Integração PMS | R$ 1.500 |
| Outros | R$ _____ |

**Total features:** R$ _____

### 4.3 Custo Variável (Tokens)

| Campo | Valor |
|-------|-------|
| Conversas estimadas/mês | _____ |
| Tokens médios por conversa | ~2.000 |
| Tokens total/mês | _____ |
| Custo token (média) | R$ 0,00005/token |
| **Custo tokens/mês** | **R$ _____** |

**Estimativa por volume:**

| Conversas/mês | Custo Tokens Estimado |
|---------------|----------------------|
| 500 | R$ 50 |
| 1.000 | R$ 100 |
| 2.000 | R$ 150 |
| 5.000 | R$ 300 |
| 10.000 | R$ 500 |

---

## 5. Cálculo de ROI

### 5.1 Investimento Total

| Item | Valor |
|------|-------|
| Setup Fee | R$ _____ |
| Features adicionais | R$ _____ |
| **TOTAL SETUP** | **R$ _____** |

| Item | Valor |
|------|-------|
| Mensalidade | R$ _____ |
| Tokens (estimado) | R$ _____ |
| **TOTAL MENSAL** | **R$ _____** |

### 5.2 ROI

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CÁLCULO DE ROI                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  VALOR GERADO/MÊS (da seção 3):         R$ _____                   │
│                                                                      │
│  INVESTIMENTO MENSAL:                    R$ _____                   │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ROI = Valor Gerado ÷ Investimento                                  │
│                                                                      │
│  ROI = R$ _____ ÷ R$ _____                                          │
│                                                                      │
│  ROI = _____x                                                       │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  PAYBACK (recuperação do setup):                                    │
│                                                                      │
│  Setup Fee ÷ (Valor Gerado - Investimento Mensal)                   │
│                                                                      │
│  R$ _____ ÷ R$ _____ = _____ meses                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Exemplo Completo

### Clínica Exemplo: Odonto Sorriso

**Dados:**
- 3 dentistas, 1 atendente
- 200 pacientes ativos
- 180 consultas/mês
- Faturamento: R$ 90.000/mês

**Perdas:**
```
No-show:
  Taxa: 28%
  Consultas perdidas: 50
  Ticket médio: R$ 500
  PERDA: R$ 25.000/mês

Leads não convertidos:
  Leads/mês: 40
  Perdidos: 50% (resposta lenta)
  Valor paciente: R$ 1.000
  PERDA: R$ 20.000/mês

Pacientes inativos:
  Inativos: 60
  Recuperáveis: 10%
  Valor retorno: R$ 500
  VALOR: R$ 3.000/mês

Custo atendente:
  Salário: R$ 2.000
  Total: R$ 2.800
  Automação: 70%
  ECONOMIA: R$ 1.960/mês

TOTAL VALOR: R$ 49.960/mês
```

**Investimento (Plano Growth):**
```
Setup Fee: R$ 6.500
Features: R$ 1.200 (Instagram + RAG)
TOTAL SETUP: R$ 7.700

Mensalidade: R$ 1.100
Tokens: R$ 120
TOTAL MENSAL: R$ 1.220
```

**ROI:**
```
ROI = R$ 49.960 ÷ R$ 1.220 = 41x

Payback = R$ 7.700 ÷ R$ 48.740 = 0,16 meses (5 dias)
```

---

## 7. Tabela de Referência Rápida

### ROI por Porte de Clínica

| Porte | Faturamento | Valor Gerado | Investimento | ROI |
|-------|-------------|--------------|--------------|-----|
| Pequeno | R$ 30-50k | R$ 9-16k | R$ 600-900 | 10-27x |
| Médio | R$ 80-150k | R$ 25-50k | R$ 1.000-1.500 | 17-50x |
| Grande | R$ 200k+ | R$ 50-100k | R$ 2.000-3.000 | 17-50x |

### Redução de No-Show Esperada

| Taxa Atual | Com Synkroo | Redução |
|------------|-------------|---------|
| 40% | 15-20% | 50-60% |
| 30% | 12-15% | 50-60% |
| 20% | 8-10% | 50-60% |

### Conversão de Leads Esperada

| Situação Atual | Com Synkroo | Melhoria |
|----------------|-------------|----------|
| Resposta em 4-8h | Resposta < 5min | +40% conversão |
| Não atende noturno | Atende 24/7 | +30% leads capturados |
| Sem follow-up | Follow-up automático | +20% conversão |

---

## 8. Perguntas para Coletar Dados

### Para calcular no-show:

1. "Você sabe qual a porcentagem de pacientes que faltam?"
2. "Manda lembrete hoje? Como funciona?"
3. "Se tivesse que chutar, quantas consultas são perdidas por mês?"

### Para calcular leads:

1. "Quantas pessoas entram em contato por mês pedindo agendamento?"
2. "Em quanto tempo você consegue responder?"
3. "Quantos desses contatos viram paciente?"
4. "Recebe mensagem de madrugada? Como faz?"

### Para calcular inativos:

1. "Quantos pacientes não voltaram no último ano?"
2. "Faz alguma coisa para trazer eles de volta?"
3. "Se mandasse uma mensagem oferecendo desconto, acha que voltariam?"

### Para calcular atendente:

1. "Quanto paga sua atendente?"
2. "O que ela mais faz no dia a dia?"
3. "Se pudesse automatizar 70% do trabalho dela, o que sobraria?"
4. "Já ficou sem atendente? Como foi?"

---

**Use esta calculadora em toda reunião de proposta para mostrar números concretos.**