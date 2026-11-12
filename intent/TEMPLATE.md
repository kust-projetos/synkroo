---
slug: <kebab-case>
author: <nome, área>
status: draft
kaneo: none
created: <YYYY-MM-DD>
---

# Intent: <título curto>

## Problem

<Que dor existe hoje, para quem, com que frequência. Evidência: ticket, log, número.>

## Proposed outcome

<Estado final observável. Não é solução técnica, é resultado.>

## Affected users and systems

<Quem usa, o que muda para eles. Sistemas/módulos tocados.>

## Constraints

<Limites duros: segurança, dados, prazo, compatibilidade, o que NÃO pode mudar.>

## Open questions

<Perguntas que só o originador ou product owner responde. Vazio = pronto para aprovar.>

<!--
Exemplo preenchido:

slug: claims-status-self-service · author: J. Ortiz, claims ops · status: approved · kaneo: OPS-142

## Problem
Clientes ligam para saber status do sinistro. 40% das chamadas do call center. Ticket OPS-142.
## Proposed outcome
Cliente vê status, próximo passo e data prevista no portal, sem ligar.
## Affected users and systems
Segurados (portal). Módulo claims-core (API), portal web (painel).
## Constraints
Sem PII nova na sessão do portal. Só autenticação existente. claims-core limita 50 rps.
## Open questions
Peritos terceirizados precisam de acesso? (aguardando PO)
-->
