# Calculadora de ROI - Synkroo (Planilha Funcional)

**Versão:** 1.0 | **Formato:** Para Google Sheets/Excel

---

## Instruções

1. Copie as tabelas abaixo para Google Sheets ou Excel
2. Preencha os campos em **AMARELO** (input do usuário)
3. Os campos em **VERDE** têm fórmulas (calculam automaticamente)
4. Use os resultados na proposta

---

## Aba 1: Dados da Clínica

| Linha | A | B | C |
|-------|---|---|---|
| **1** | **DADOS DA CLÍNICA** | **Valor** | **Como descobrir** |
| **2** | Nome da clínica | [INPUT] | Perguntar |
| **3** | Segmento | [INPUT] | Odonto/Estética/Fisio/Outro |
| **4** | Nº profissionais | [INPUT] | Perguntar |
| **5** | Nº atendentes | [INPUT] | Perguntar |
| **6** | Pacientes ativos | [INPUT] | Perguntar |
| **7** | Consultas/mês | `=B6*0.8` | Ou perguntar direto |
| **8** | Faturamento/mês (R$) | [INPUT] | Perguntar ou estimar |
| **9** | Ticket médio | `=B8/B7` | Automático |

---

## Aba 2: Análise de Perdas

### Seção 1: No-Show

| Linha | A | B | C |
|-------|---|---|---|
| **1** | **NO-SHOW** | **Valor** | **Fórmula** |
| **2** | Taxa de no-show atual (%) | [INPUT: 15-40] | Perguntar |
| **3** | Consultas perdidas/mês | `=Dados!B7*B2/100` | Automático |
| **4** | Ticket médio | `=Dados!B9` | Link da aba Dados |
| **5** | **PERDA NO-SHOW (R$)** | `=B3*B4` | **RESULTADO** |
| **6** | Redução esperada (%) | 50 | Fixo |
| **7** | **VALOR RECUPERÁVEL** | `=B5*B6/100` | **RESULTADO** |

### Seção 2: Leads Não Convertidos

| Linha | A | B | C |
|-------|---|---|---|
| **1** | **LEADS** | **Valor** | **Fórmula** |
| **2** | Leads que chegam/mês | [INPUT] | Perguntar |
| **3** | Tempo médio de resposta (h) | [INPUT: 1-24] | Perguntar |
| **4** | % perdidos por demora | `=IF(B3>4,50,IF(B3>2,30,10))` | Automático |
| **5** | Leads perdidos/mês | `=B2*B4/100` | Automático |
| **6** | Valor paciente novo (R$) | [INPUT] | LTV ou perguntar |
| **7** | **PERDA LEADS (R$)** | `=B5*B6` | **RESULTADO** |
| **8** | Conversão esperada (%) | 40 | Fixo |
| **9** | **VALOR RECUPERÁVEL** | `=B7*B8/100` | **RESULTADO** |

### Seção 3: Pacientes Inativos

| Linha | A | B | C |
|-------|---|---|---|
| **1** | **INATIVOS** | **Valor** | **Fórmula** |
| **2** | Pacientes ativos | `=Dados!B6` | Link da aba Dados |
| **3** | % inativos estimado | 35 | Fixo (perguntar se sabe) |
| **4** | Pacientes inativos | `=B2*B3/100` | Automático |
| **5** | % que voltaria | 15 | Fixo |
| **6** | Pacientes recuperáveis | `=B4*B5/100` | Automático |
| **7** | Valor retorno (R$) | `=Dados!B9*2` | Ticket × 2 |
| **8** | **VALOR RECUPERÁVEL** | `=B6*B7` | **RESULTADO** |

### Seção 4: Economia com Atendente

| Linha | A | B | C |
|-------|---|---|---|
| **1** | **ATENDENTE** | **Valor** | **Fórmula** |
| **2** | Salário base (R$) | [INPUT] | Perguntar |
| **3** | Encargos (40%) | `=B2*0.4` | Automático |
| **4** | Custo total | `=B2+B3` | Automático |
| **5** | % que pode automatizar | 70 | Fixo |
| **6** | **ECONOMIA POTENCIAL** | `=B4*B5/100` | **RESULTADO** |

---

## Aba 3: Resumo e ROI

### Resumo de Valor

| Linha | A | B |
|-------|---|---|
| **1** | **RESUMO DE VALOR** | **R$/mês** |
| **2** | Valor recuperável no-show | `='No-Show'!B7` |
| **3** | Valor recuperável leads | `='Leads'!B9` |
| **4** | Valor recuperável inativos | `='Inativos'!B8` |
| **5** | Economia atendente | `='Atendente'!B6` |
| **6** | **TOTAL VALOR/MÊS** | `=SUM(B2:B5)` |

### Cálculo de Investimento

| Linha | A | B | C |
|-------|---|---|---|
| **1** | **INVESTIMENTO** | **Plano** | **Valor** |
| **2** | Plano escolhido | [INPUT: Starter/Growth/Scale] | - |
| **3** | Setup Fee (R$) | [INPUT] | - |
| **4** | Features adicionais (R$) | [INPUT ou 0] | - |
| **5** | **TOTAL SETUP** | `=B3+B4` | **RESULTADO** |
| **6** | Mensalidade (R$) | [INPUT] | - |
| **7** | Conversas estimadas/mês | `=Dados!B7*2` | Automático |
| **8** | Custo tokens (R$) | `=B7*0.05` | ~R$ 0.05/conversa |
| **9** | **TOTAL MENSAL** | `=B6+B8` | **RESULTADO** |

### ROI Final

| Linha | A | B | C |
|-------|---|---|---|
| **1** | **ROI** | **Valor** | **Fórmula** |
| **2** | Valor gerado/mês | `=Resumo!B6` | Link |
| **3** | Investimento mensal | `=Investimento!B9` | Link |
| **4** | **ROI (x)** | `=B2/B3` | **RESULTADO** |
| **5** | Lucro mensal líquido | `=B2-B3` | **RESULTADO** |
| **6** | Setup Fee | `=Investimento!B5` | Link |
| **7** | **PAYBACK (meses)** | `=B6/B5` | **RESULTADO** |

---

## Aba 4: Recomendação de Plano

| Porte | Faturamento | Plano Sugerido | Setup | Mensal | ROI Esperado |
|-------|-------------|----------------|-------|--------|--------------|
| Pequeno | R$ 30-50k | Starter | R$ 3-5k | R$ 500-800 | 10-27x |
| Médio | R$ 80-150k | Growth | R$ 5-10k | R$ 800-1.500 | 17-50x |
| Grande | R$ 200k+ | Scale | R$ 10-20k | R$ 1.500-3.000 | 17-50x |

---

## Fórmulas Prontas para Copiar

### Google Sheets

```
// ROI
=IF(B3>0, B2/B3, 0)

// Payback
=IF(B5>0, B6/B5, "N/A")

// Taxa de perda por demora
=IF(B3>4, 50, IF(B3>2, 30, 10))

// Conversas estimadas
=Dados!B7*2

// Custo tokens
=B7*0.05
```

### Excel (PT-BR)

```
// ROI
=SE(B3>0; B2/B3; 0)

// Payback
=SE(B5>0; B6/B5; "N/D")

// Taxa de perda por demora
=SE(B3>4; 50; SE(B3>2; 30; 10))
```

---

## Benchmark de Referência

| Métrica | Mercado | Com Synkroo | Melhoria |
|---------|---------|-------------|----------|
| No-show | 25-35% | 10-15% | -50-60% |
| Resposta lead | 4-8h | <5min | 48-96x mais rápido |
| Conversão lead | 20-30% | 40-60% | +100% |
| Pacientes reativados | 5% | 15% | +200% |

---

**Dica:** Crie uma cópia deste arquivo para cada cliente e salve em `docs/sales/calculations/[cliente]-[data].xlsx`