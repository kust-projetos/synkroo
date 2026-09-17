# Política de Migrations (Etapa 8)

## Modelo obrigatório: expand → migrate → switch → contract

Toda mudança destrutiva de schema passa por quatro fases, em deploys
separados:

1. **Expand** — adiciona a estrutura nova (coluna/tabela/índice/constraint)
   sem remover a antiga. Código passa a escrever nas duas (dual-write)
   e a ler da nova com fallback para a antiga (dual-read) ou feature flag.
2. **Migrate** — backfill dos dados antigos para a estrutura nova, em job
   separado da migration comum (ver "Backfills grandes" abaixo).
3. **Switch** — todo o tráfego lê/escreve só na estrutura nova. A antiga
   fica sem leitores nem escritores, mas ainda existe no banco.
4. **Contract** — só então a estrutura antiga pode ser removida, e apenas
   se **todas** as condições abaixo forem atendidas.

## Proibição de contract em produção

Remover coluna, tabela, índice, constraint ou qualquer estrutura em uso
(contract) é **PROIBIDO** em produção sem, cumulativamente:

- backup restaurado com evidência (restore testado, não só backup criado);
- confirmação de que **nenhuma versão ativa** usa a estrutura antiga
  (busca no código + versões em deploy/rollback ainda suportadas);
- janela de observação pós-Deploy B (switch em produção por tempo
  suficiente para capturar ciclos de uso — ex. fim de semana cheio);
- forward-fix documentado caso o contract precise ser revertido
  (reverter contract = re-expand, nunca "desfazer" dados perdidos);
- aprovação operacional explícita (registrar quem aprovou, quando e onde).

## Backfills grandes

Backfill de volume relevante **nunca** vai dentro de migration comum do
`drizzle-kit migrate` (que roda no boot do deploy e trava a janela):

- roda como job/script separado, idempotente e retomável (batches com
  `LIMIT`/cursor, throttling);
- tem guarda de pré-voo (`RAISE EXCEPTION` em divergência, como já fazem
  `0016` e `0022`) e contagem antes/depois auditável;
- migration comum só declara a estrutura; dados vêm depois, no job.

## Rollback ≠ sempre DOWN

- `DOWN` (statements comentados `--` nas migrations) é nota de intenção,
  não plano de rollback testado — drizzle-kit aplica só `UP`.
- Rollback de **expand/migrate/switch** = forward-fix, flag ou dual-read
  de volta para a estrutura antiga (que ainda existe).
- Rollback de **contract** não recupera dados: exige restore de backup
  ou re-expand + re-backfill. É por isso que contract tem as cinco
  condições acima.

## Inventário atual (31 migrations, `0000`–`0031`)

Verificação estática por `DROP`/`DELETE`/`TRUNCATE` ativos (não comentados):

| Migration | Achado | Avaliação |
|---|---|---|
| `0027_drop-is-master.sql` | `ALTER TABLE users DROP COLUMN is_master` (contract real) | **Executado/histórico** — evidência: zero referências a `is_master` em `src/**` (só `0000` cria e `0027` remove; resto é arquivo morto). Nenhum consumidor ativo da estrutura antiga. |
| `0016_consent_tenant_unique.sql` | `DROP INDEX` antigo + `CREATE UNIQUE INDEX` tenant-scoped, com guarda de duplicatas pré-voo | Troca de índice, sem perda de dados. Histórico. |
| `0022_far_stature.sql` | `DROP INDEX` + recriação normalizada + `UPDATE` de normalização de e-mail, com guarda pré-voo | Troca de índice + normalização guardada. Histórico. |
| `0008_remarkable_gamma_corps.sql` | `DROP CONSTRAINT` de check redundante | Remoção de constraint, sem perda de dados. Histórico. |
| demais (`0001`, `0002`, `0004`–`0007` etc.) | `DROP` apenas em comentários `--` (DOWN notes) | Não executam nada. Sem efeito. |

Nenhum `DELETE FROM` / `TRUNCATE` ativo em nenhuma das 31 migrations.

**Conclusão: nenhuma migration destrutiva PENDENTE.** Os contracts
existentes já foram aplicados e não têm consumidores ativos. Próximo
contract futuro deve seguir as cinco condições acima, e o job
`migrations-from-zero` do CI garante que a cadeia `0000`→`0031` aplica
limpa a partir de banco vazio e é idempotente.
