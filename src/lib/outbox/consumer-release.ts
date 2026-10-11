/**
 * Resolução do release do consumidor do outbox (metadado de execução).
 *
 * Toda claim registra o release que a executou (`outbox_jobs.claim_release`),
 * e o gate da migration 0036 passa a exigir esse release depois que um resume
 * explícito arma `outbox_control.release_id`: binário antigo — que não escreve
 * a coluna — não claima nem liquida em `RUNNING`.
 *
 * Ordem de resolução (a primeira fonte disponível vence):
 *   1. `OUTBOX_RELEASE_ID` (override explícito do operador/dev/teste);
 *   2. Cloudflare Worker version metadata (`CF_VERSION_METADATA.id`), obtido
 *      pelo contexto OpenNext do request — bindings não são `process.env`;
 *   3. desconhecido (`null`) — falha FECHADA em claim/resume com gate armado.
 *
 * Função pura em `resolveConsumerRelease(env)`: sem I/O, testável sem runtime.
 *
 * Identidade NUNCA passa por sanitizador de PII: o release é um token opaco
 * (sha de commit, UUID, id de versão do Cloudflare). `sanitizeControlText`
 * redigiria runs longos ("[redacted]") e destruiria a identidade — por isso a
 * validação é por PADRÃO CANÔNICO + teto de tamanho (`normalizeReleaseId`),
 * compartilhado pelo claim, pelo resume e pelo teste. `reason`/`operator`
 * continuam sanitizados (ver `control.ts`).
 */

/** Sentinela de release desconhecido — nunca pode armar o gate. */
export const UNKNOWN_RELEASE = 'unknown';

/** Teto do identificador de release (evita payload gigante na coluna/ledger). */
export const RELEASE_MAX_LENGTH = 64;

/**
 * Padrão canônico do identificador de release.
 *
 * Aceita somente SHA hexadecimal (com ao menos uma letra a-f) ou UUID
 * canônico do Cloudflare. Tags/slugs/texto livre são recusados: o release é
 * persistido e aparece na status view, portanto não deve carregar PII/segredo.
 */
export const RELEASE_PATTERN = /^(?:(?=[0-9a-f]{7,64}$)(?=.*[a-f])[0-9a-f]+|(?=[0-9a-f-]{36}$)(?=.*[a-f])[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i;

/** True quando o valor é um identificador de release bem formado. */
export function isValidReleaseId(value: unknown): value is string {
  return typeof value === 'string' && RELEASE_PATTERN.test(value);
}

/**
 * Normaliza um identificador de release: aparado, dentro do teto e dentro do
 * padrão. `null` para ausente, vazio ou malformado (falha fechada — o caller
 * decide entre "obrigatório" e "inválido").
 */
export function normalizeReleaseId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > RELEASE_MAX_LENGTH) return null;
  if (!RELEASE_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/**
 * Nome do GUC transacional que carrega o token de posse do lease.
 *
 * `set_config('outbox.claim_marker', <token>, true)` (escopo de transação,
 * equivalente a `SET LOCAL`) é gravado na MESMA transão do claim/liquidação e
 * lido pelo trigger `outbox_enforce_control_gate`. O binário antigo não escreve
 * o GUC — e um UPDATE solto (sem transação que arme o marcador) não casa com
 * nenhum lease válido.
 */
export const CLAIM_MARKER_SETTING = 'outbox.claim_marker';

/**
 * Token de posse do lease: `<release>#<claim_generation>`.
 *
 * Amarra o caller à geração EXATA da linha: um holder antigo (mesmo release,
 * geração anterior) não casa com o token da geração atual. O release é
 * validado pelo padrão canônico, então o separador `#` nunca aparece dentro
 * dele — o token é não ambíguo.
 */
export function buildClaimMarker(release: string | null, claimGeneration: number): string {
  return `${release ?? ''}#${claimGeneration}`;
}

/**
 * Resolve o release do consumidor a partir de um mapa de ambiente.
 * Devolve `null` quando desconhecido ou malformado (nenhuma fonte válida).
 */
export function resolveConsumerRelease(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const explicit = normalizeReleaseId(env.OUTBOX_RELEASE_ID);
  if (explicit) return explicit;

  // Compatibilidade com harnesses que injetam o binding serializado. O runtime
  // OpenNext usa getCloudflareContext() abaixo; bindings não são process.env.
  const rawMetadata = env.CF_VERSION_METADATA;
  if (typeof rawMetadata === 'string' && rawMetadata.trim()) {
    try {
      const metadata = JSON.parse(rawMetadata) as { id?: unknown };
      const id = normalizeReleaseId(metadata?.id);
      if (id) return id;
    } catch {
      // Metadata inválido permanece desconhecido (fail closed).
    }
  }

  return null;
}

/** Release do processo atual (atalho de `resolveConsumerRelease(process.env)`). */
export async function getConsumerRelease(): Promise<string | null> {
  const explicit = resolveConsumerRelease(process.env);
  if (explicit) return explicit;

  try {
    // OpenNext expõe bindings pelo contexto da invocação. O version metadata
    // não é uma variável de processo e deve ser lido durante o request.
    // Cast local evita acoplar o domínio ao tipo gerado pelo Wrangler.
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = getCloudflareContext() as {
      env?: { CF_VERSION_METADATA?: { id?: unknown } };
    };
    const id = normalizeReleaseId(context.env?.CF_VERSION_METADATA?.id);
    return id;
  } catch {
    // Fora de um request Worker (Node, teste, SSG), ausência é desconhecida.
    return null;
  }
}

/**
 * True quando o release conhecido pode armar o gate do resume.
 * `unknown`/vazio nunca armam — o gate só existe com identidade real.
 */
export function isArmableRelease(release: string | null | undefined): release is string {
  const normalized = normalizeReleaseId(release);
  return normalized !== null && normalized.toLowerCase() !== UNKNOWN_RELEASE;
}
