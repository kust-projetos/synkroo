# F4.01 — API response contract

`src/lib/api/response.ts` fornece ApiSuccess, ApiFailure, helpers de status e requestId. O contrato foi verificado sem declarar que todas as rotas já foram migradas.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/api/__tests__/response.test.ts --runInBand` | PASS — 16 testes |

Residual separado: F4.02/F4.03/F4.04 continuam responsáveis por adapter, serializers e migração/contratos de consumidores.
