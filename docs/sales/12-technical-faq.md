# FAQ Técnico - Synkroo

**Versão:** 1.0 | **Uso:** Respostas para dúvidas técnicas de clientes

---

## Integração e Conectividade

### P: Como funciona a integração com meu sistema atual?

**R:** Depende do plano:

| Plano | Integração |
|-------|------------|
| Starter | Independente (dados no Synkroo) |
| Growth | Independente + exportação de dados |
| Scale | Sincronização bidirecional via API |

**Planos com integração (Scale):**
1. Conectamos via API do seu sistema (se disponível)
2. Sincronizamos pacientes, agenda e procedimentos
3. Agendamentos feitos pela IA aparecem no seu sistema
4. Atualizações de status são sincronizadas

**Sistemas compatíveis:**
- Doctoralia
- Feegow
- Simples
- iClinic
- Outros (verificar API)

---

### P: Preciso de infraestrutura própria? Servidor? Cloud?

**R:** Não. O Synkroo é 100% SaaS (Software as a Service).

- Tudo roda na nossa nuvem
- Você só precisa de um aparelho de celular ou computador para acessar o dashboard
- Zero infraestrutura necessária
- Zero manutenção técnica

---

### P: Funciona com qualquer número de WhatsApp?

**R:** Sim, mas recomendamos WhatsApp Business:

| Tipo | Funciona? | Recomendado? |
|------|-----------|--------------|
| Pessoal | Sim | Não (mistura contatos) |
| Business | Sim | **Sim** |
| Business API | Sim | Sim (mais recursos) |

**Configuração:**
1. Você fornece o número
2. Configuramos a conexão
3. Número continua sendo seu
4. Você pode desconectar a qualquer momento

---

### P: Como vocês conectam no meu WhatsApp?

**R:** Duas formas:

**Método 1 (Recomendado - WhatsApp Business API)**
- Provisionamos uma API oficial
- Aprovação do Meta (2-5 dias)
- Mais estável e escalável
- Incluído no plano Scale

**Método 2 (Todos os planos)**
- Conexão via QR Code (como WhatsApp Web)
- Você escaneia e autoriza
- Funciona imediatamente
- Requer celular ou emulador sempre ligado

---

## Segurança e Privacidade

### P: Quem tem acesso às conversas?

**R:** Controle total:

- **Você:** Acesso a todas as conversas da sua clínica
- **Sua equipe:** Acesso conforme permissões que você define
- **Synkroo:** Acesso técnico apenas para suporte (auditado)
- **Terceiros:** Zero acesso

---

### P: Os dados dos pacientes estão seguros?

**R:** Sim, com múltiplas camadas de proteção:

| Camada | Medida |
|--------|--------|
| Trânsito | Criptografia TLS 1.3 |
| Repouso | Criptografia AES-256 |
| Acesso | Autenticação 2FA disponível |
| Backup | Diário, retenção 30 dias |
| Infraestrutura | AWS/Google Cloud, ISO 27001 |

---

### P: O Synkroo é compatível com LGPD?

**R:** Sim, totalmente:

**Como Operador de dados (Synkroo):**
- Processamos dados apenas para o serviço
- Não vendemos nem compartilhamos dados
- Implementamos segurança adequada
- Apagamos dados após término do contrato

**Como Controlador de dados (VOCÊ):**
- Você deve obter consentimento dos pacientes
- Você deve informar sobre uso de IA
- Você responde por solicitações de direitos
- Você define lawful basis

**Fornecemos:**
- Termos de uso sugeridos para pacientes
- Modelo de aviso de privacidade
- Suporte para solicitações de titulares

---

### P: O que acontece com meus dados se eu cancelar?

**R:** Você tem controle total:

1. **Até 90 dias após cancelamento:**
   - Acesso completo para download
   - Exportação em CSV/JSON
   - Relatórios completos

2. **Após 90 dias:**
   - Dados deletados permanentemente
   - Backups expirados
   - Certificado de destruição disponível

---

## Funcionamento do Agente IA

### P: Como a IA aprende sobre minha clínica?

**R:** Em 3 etapas:

**1. Onboarding (configuração inicial)**
- Preenchemos questionário sobre sua rotina
- Horários, profissionais, procedimentos
- Políticas de cancelamento, reagendamento
- FAQ específico da clínica

**2. Base de conhecimento (RAG)**
- Documentos, manuais, scripts
- Protocolos de atendimento
- Preços e procedimentos
- IA consulta em tempo real

**3. Aprendizado contínuo**
- Correções suas durante uso
- Padrões que funcionam
- Feedback de pacientes

---

### P: A IA pode cometer erros? O que acontece?

**R:** Sim, é uma IA, mas com salvaguardas:

**Tipos de erros possíveis:**
- Interpretar mal uma mensagem ambígua
- Agendar horário errado (raro)
- Resposta fora do tom

**Medidas de proteção:**
1. **Protocolos definidos:** IA segue regras da sua clínica
2. **Confirmação:** Agenda apenas após confirmar com paciente
3. **Alertas:** IA te avisa quando tem dúvida
4. **Logs:** Todas conversas ficam gravadas
5. **Correção:** Você pode corrigir a qualquer momento

**Se der errado:**
- Você é notificado
- Pode reverter ação
- IA aprende com correção

---

### P: A IA faz diagnósticos médicos?

**R:** NÃO. Absolutamente não.

**O que a IA faz:**
- Agendar consultas
- Enviar lembretes
- Responder perguntas sobre horários, preços, procedimentos
- Fazer follow-up pós-consulta

**O que a IA NÃO faz:**
- Diagnóstico médico
- Recomendação de tratamento
- Interpretação de exames
- Qualquer decisão clínica

**Quando paciente pergunta sobre saúde:**
- IA orienta a marcar consulta
- Não fornece opinião médica
- Escala para profissional se necessário

---

### P: Como funciona a "memória" da IA?

**R:** A IA lembra conversas anteriores:

**Memória de curto prazo (sessão):**
- Contexto da conversa atual
- "Você disse que queria dia 15, certo?"

**Memória de longo prazo (paciente):**
- Histórico de conversas anteriores
- Preferências do paciente
- Tratamentos em andamento
- Últimas consultas

**Exemplo:**
```
Paciente: "Quero remarcar"
IA: "Oi Maria! Você tem consulta com a Dra. Ana
     na quinta às 14h. Para qual dia quer remarcar?"
```

A IA sabe quem é o paciente, qual a consulta, qual profissional.

---

### P: A IA atende em outros idiomas?

**R:** Português nativo. Outros idiomas em desenvolvimento.

| Idioma | Status |
|--------|--------|
| Português (BR) | ✅ Nativo |
| Espanhol | 🚧 Beta (Growth+) |
| Inglês | 🚧 Beta (Scale) |

---

## Performance e Confiabilidade

### P: O sistema cai muito?

**R:** Meta de 99,5% de uptime:

| Métrica | Valor |
|---------|-------|
| Uptime mensal | 99,5%+ |
| Tempo fora do ar/mês | < 3,6h |
| Manutenção programada | Aos domingos 6h-8h |
| Notificação manutenção | 48h antes |

**Créditos se cair mais:**
- >1% fora do ar: 10% desconto
- >2% fora do ar: 25% desconto
- >5% fora do ar: 50% desconto

---

### P: E se cair no horário de pico?

**R:** Impacto minimizado:

- Infraestrutura redundante
- Failover automático
- Recuperação em minutos
- Notificação imediata

**Durante queda:**
- WhatsApp continua funcionando (aparelho ainda conectado)
- Mensagens são enfileiradas
- Processadas quando volta

---

### P: Quantas conversas simultâneas a aguenta?

**R:** Por plano:

| Plano | Conversas/mês | Simultâneas |
|-------|---------------|-------------|
| Starter | 500 | ~10 |
| Growth | 2.000 | ~50 |
| Scale | 5.000+ | ~100+ |

**Na prática:**
- Cada conversa dura ~2-5 minutos
- IA responde em <3 segundos
- Pode atender dezenas ao mesmo tempo
- Não cansa, não estressa

---

## Custo e Tokens

### P: O que são tokens exatamente?

**R:** Tokens são unidades de processamento da IA:

- 1 token ≈ 4 caracteres (em português)
- 1 palavra ≈ 1-2 tokens
- Cada mensagem consome tokens (input + output)

**Exemplo de conversa:**
```
Paciente: "Quero marcar uma consulta" (6 tokens)
IA: "Claro! Qual profissional você prefere?" (8 tokens)
Total: 14 tokens
```

**Custo médio:**
- ~2.000 tokens por conversa completa
- R$ 0,00005/token
- R$ 0,10 por conversa

---

### P: Como sei quanto vou gastar com tokens?

**R:** Dashboard em tempo real:

- Contador de tokens consumidos
- Projeção para o mês
- Alertas se passar de limite
- Histórico de consumo

**Estimativa por porte:**

| Porte | Conversas/mês | Tokens/mês | Custo/mês |
|-------|---------------|------------|-----------|
| Pequeno | 200-500 | 400k-1M | R$ 20-50 |
| Médio | 500-2.000 | 1M-4M | R$ 50-200 |
| Grande | 2.000-5.000 | 4M-10M | R$ 200-500 |

---

### P: Posso limitar o gasto com tokens?

**R:** Sim, controles disponíveis:

1. **Alerta:** Aviso ao atingir X tokens
2. **Limite suave:** IA avisa usuário que está ocupado
3. **Limite duro:** Para de responder (não recomendado)

---

## Implementação e Suporte

### P: Quanto tempo demora para implementar?

**R:** 1-2 semanas:

| Etapa | Dias | O que acontece |
|-------|------|----------------|
| Contrato | 0 | Assinatura + 50% setup |
| Onboarding | 1-2 | Reunião, questionário |
| Configuração | 3-7 | Setup técnico, treinamento IA |
| Testes | 8-10 | Validação com você |
| Treinamento | 11-12 | Sua equipe aprende |
| Go-live | 13-14 | Início oficial |
| Acompanhamento | 15-30 | Suporte intensivo |

---

### P: O que eu preciso fazer durante a implementação?

**R:** Sua parte:

1. **Responder questionário** (30 min)
   - Horários, profissionais, procedimentos
   - Políticas da clínica
   - FAQ comum

2. **Fornecer materiais** (se tiver)
   - Scripts de atendimento
   - Tabela de preços
   - Manual da clínica

3. **Participar do treinamento** (2-4h)
   - Sua equipe aprende a usar
   - Como monitorar conversas
   - Como corrigir a IA

4. **Validar antes do go-live** (1h)
   - Testar cenários
   - Ajustar finais

---

### P: Tenho suporte depois do go-live?

**R:** Sim, incluso:

| Plano | Canal | Horário | SLA |
|-------|-------|---------|-----|
| Starter | WhatsApp | 9h-18h úteis | 24h |
| Growth | WhatsApp | 9h-18h úteis | 8h |
| Scale | WhatsApp + Email | 9h-18h úteis | 4h |

**Suporte incluso:**
- Dúvidas de uso
- Correções na IA
- Ajustes de configuração
- Treinamento adicional (sob agendamento)

**Não incluso:**
- Desenvolvimento de features novas
- Integrações customizadas
- Suporte presencial

---

### P: Posso cancelar se não funcionar?

**R:** Sim, garantia de 15 dias:

- 50% do setup de volta
- Nenhuma mensalidade cobrada
- Sem multa ou burocracia

**Após 15 dias:**
- Sem fidelidade mínima
- Aviso de 30 dias
- Dados disponíveis por 90 dias

---

## Personalização

### P: Posso personalizar as respostas da IA?

**R:** Sim, vários níveis:

**Nível 1 - Tom e estilo:**
- Formal ou informal
- Uso de emojis ou não
- Nome do agente

**Nível 2 - Fluxos:**
- Mensagens padrão
- Sequências de follow-up
- Gatilhos específicos

**Nível 3 - Base de conhecimento (RAG):**
- FAQs da sua clínica
- Protocolos específicos
- Preços e promoções

**Nível 4 - Integrações (Scale):**
- Consulta ao seu sistema
- Regras específicas de agendamento
- Lógica customizada

---

### P: Posso ter diferentes "personalidades" para cada profissional?

**R:** No plano Scale, sim.

Exemplo:
- Agente geral para triagem
- Agente específico para cada dentista
- Tom personalizado por profissional

---

### P: Posso desativar a IA em horários específicos?

**R:** Sim:

- Configurar horários de operação
- IA atende apenas no horário definido
- Fora do horário: mensagem automática
- Você pode ligar/desligar manualmente

---

## Funcionalidades Específicas

### P: Como funciona o lembrete de consulta?

**R:** Automático e configurável:

| Timing | Ação |
|--------|------|
| 24h antes | Mensagem de confirmação |
| 2h antes | Lembrete final |
| Após consulta | Follow-up de satisfação |

**Personalizável:**
- Timing (24h/48h/72h antes)
- Mensagem
- Ação se não confirmar (alertar você, ligar, etc.)

---

### P: Como funciona a detecção de no-show?

**R:** IA analisa padrões:

**Sinais que a IA detecta:**
- Paciente já faltou antes
- Confirmou tardiamente
- Histórico de cancelamentos
- Padrão de comunicação

**Score de risco (0-100):**
- 0-30: Baixo risco
- 31-60: Médio risco
- 61-100: Alto risco

**Ação automática:**
- Alto risco: IA reforça confirmação
- Você é notificado
- Pode contatar pessoalmente

---

### P: Como funciona a reativação de pacientes inativos?

**R:** Campanhas automáticas:

**Gatilhos:**
- Paciente sem consulta há 3 meses
- Paciente sem consulta há 6 meses
- Paciente abandonou tratamento

**Ação:**
- IA envia mensagem personalizada
- Oferece horário disponível
- Escala para você se tiver interesse

**Personalizável:**
- Timing dos gatilhos
- Mensagem enviada
- Oferta ou desconto

---

## Versão e Atualizações

**Última atualização:** Março 2026
**Próxima revisão:** Junho 2026

---

**Uso: responder dúvidas técnicas de clientes, treinar equipe de vendas.**