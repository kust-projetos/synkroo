# Checklist - Setup Clínica Piloto

## Pré-Requisitos

Antes de iniciar, verifique:

- [ ] Acesso ao painel administrativo do Synkroo
- [ ] WhatsApp Business ou número dedicado para a clínica
- [ ] Lista de dentistas com dados completos
- [ ] Lista de procedimentos oferecidos
- [ ] Lista de pacientes existentes (opcional)

---

## Fase 1: Configuração Inicial (30 min)

### 1.1 Criar Conta Admin

- [ ] Acessar URL de cadastro
- [ ] Preencher dados do administrador
- [ ] Confirmar e-mail
- [ ] Fazer login

### 1.2 Completar Perfil da Clínica

| Campo | Valor |
|-------|-------|
| Nome da Clínica | ________________ |
| CNPJ | ________________ |
| Telefone/WhatsApp | ________________ |
| Endereço | ________________ |
| Cidade/UF | ________________ |

### 1.3 Configurar Horários

| Dia | Abertura | Fechamento | Almoço |
|-----|----------|------------|--------|
| Segunda | _____ | _____ | _____ |
| Terça | _____ | _____ | _____ |
| Quarta | _____ | _____ | _____ |
| Quinta | _____ | _____ | _____ |
| Sexta | _____ | _____ | _____ |
| Sábado | _____ | _____ | _____ |

---

## Fase 2: Cadastros (1-2 horas)

### 2.1 Dentistas

Para cada dentista, cadastrar:

| Dentista | Nome | Especialidade | CRO | Dias |
|----------|------|---------------|-----|------|
| 1 | _________ | _________ | _________ | _________ |
| 2 | _________ | _________ | _________ | _________ |
| 3 | _________ | _________ | _________ | _________ |
| 4 | _________ | _________ | _________ | _________ |

**Checklist por dentista:**
- [ ] Nome completo
- [ ] Especialidade
- [ ] CPF
- [ ] CRO
- [ ] Telefone
- [ ] E-mail
- [ ] Dias de atendimento
- [ ] Horários

### 2.2 Procedimentos

| Procedimento | Duração | Valor |
|--------------|---------|-------|
| Consulta | 30 min | R$ ___ |
| Limpeza | 45 min | R$ ___ |
| Clareamento | 60 min | R$ ___ |
| Extração | 45 min | R$ ___ |
| Canal | 90 min | R$ ___ |
| _________ | ___ min | R$ ___ |
| _________ | ___ min | R$ ___ |
| _________ | ___ min | R$ ___ |

**Checklist por procedimento:**
- [ ] Nome
- [ ] Descrição
- [ ] Duração
- [ ] Valor (opcional)
- [ ] Ativo

### 2.3 Pacientes (Importação)

**Opção A: Manual**
- [ ] Cadastrar 5-10 pacientes de teste

**Opção B: Importação em massa**
- [ ] Solicitar template ao suporte
- [ ] Preencher planilha
- [ ] Enviar para importação
- [ ] Verificar dados importados

---

## Fase 3: Conectar WhatsApp (15 min)

### 3.1 Preparação

- [ ] Ter o chip/WhatsApp dedicado em mãos
- [ ] Certificar que o número está ativo

### 3.2 Conexão

- [ ] Acessar **Configurações** > **WhatsApp**
- [ ] Clicar em **Conectar**
- [ ] Escanear QR Code:
  - Abrir WhatsApp no celular
  - Menu > Dispositivos conectados
  - Conectar dispositivo
  - Apontar câmera para QR
- [ ] Aguardar confirmação

### 3.3 Teste

- [ ] Enviar mensagem de teste para o número
- [ ] Verificar se a IA responde
- [ ] Testar comando de agendamento

---

## Fase 4: Testes (30 min)

### 4.1 Teste de Agendamento

**Cenário 1: Agendar consulta**
```
Enviar: "Quero marcar uma consulta"
Esperado: IA pede data
Enviar: "Amanhã"
Esperado: Mostra horários disponíveis
Enviar: "10:00"
Esperado: Confirma agendamento
```
- [ ] Teste realizado com sucesso

**Cenário 2: Emergência**
```
Enviar: "Estou com dor de dente muito forte"
Esperado: Escala para humano
```
- [ ] Teste realizado com sucesso

**Cenário 3: Dúvida**
```
Enviar: "Qual o valor do clareamento?"
Esperado: Resposta apropriada
```
- [ ] Teste realizado com sucesso

### 4.2 Teste de Dashboard

- [ ] Ver agendamentos do dia
- [ ] Filtrar por dentista
- [ ] Confirmar um agendamento
- [ ] Cancelar um agendamento
- [ ] Ver lista de pacientes
- [ ] Ver lista de espera

### 4.3 Teste de Lembretes

- [ ] Criar agendamento para 24h no futuro
- [ ] Aguardar lembrete automático OU
- [ ] Usar botão "Enviar lembrete" manual

---

## Fase 5: Treinamento da Equipe (1 hora)

### 5.1 Pessoas a Treinar

| Nome | Função | Treinamento |
|------|--------|-------------|
| _________ | Admin | Completo |
| _________ | Recepcionista | Agendamentos, Pacientes |
| _________ | Dentista | Ver agenda própria |
| _________ | _________ | _________ |

### 5.2 Tópicos de Treinamento

**Para todos:**
- [ ] Login e navegação básica
- [ ] Dashboard principal
- [ ] Como a IA funciona

**Para recepcionistas:**
- [ ] Cadastrar pacientes
- [ ] Gerenciar agendamentos
- [ ] Ver e responder conversas
- [ ] Gerenciar lista de espera

**Para administradores:**
- [ ] Configurações da clínica
- [ ] Gerenciar usuários
- [ ] Relatórios
- [ ] Backup

---

## Fase 6: Go-Live

### 6.1 Checklist Final

- [ ] Todos os dentistas cadastrados
- [ ] Todos os procedimentos configurados
- [ ] WhatsApp conectado e funcionando
- [ ] Testes realizados com sucesso
- [ ] Equipe treinada
- [ ] Número do WhatsApp divulgado

### 6.2 Divulgação

- [ ] Avisar pacientes sobre o novo canal
- [ ] Postar nas redes sociais
- [ ] Adicionar botão no site (se houver)
- [ ] Colocar placa na recepção

---

## Contatos de Suporte

| Tipo | Contato |
|------|---------|
| E-mail | suporte@synkroo.com.br |
| WhatsApp | (11) 99999-9999 |
| Horário | Seg-Sex, 9h-18h |

---

## Notas

```
Data do setup: ___/___/______
Responsável: ______________
Observações:
_______________________________________
_______________________________________
_______________________________________
```

---

*Versão: 1.0 - Março 2026*