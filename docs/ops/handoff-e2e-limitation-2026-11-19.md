# Limitação do E2E de transferência humana — 2026-11-19

A correção funcional da resposta de escalonamento permanece coberta por testes
unitários. O E2E integrado foi tentado e removido: nos runs de CI
[44587613967](https://github.com/kust-projetos/synkroo/actions/runs/44587613967)
e [44584847773](https://github.com/kust-projetos/synkroo/actions/runs/44584847773),
o job do outbox falhou com erro sanitizado após a conversa chegar a
`escalated`; a resposta não foi gravada no histórico. Isso não caracteriza
regressão do código de produção. Próximo passo: adicionar observabilidade do
erro real no outbox e reintroduzir o E2E.
