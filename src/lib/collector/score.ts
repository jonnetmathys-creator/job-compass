import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const SCORE_SCHEMA = {
  type: 'object',
  properties: { score: { type: 'integer' } },
  required: ['score'],
  additionalProperties: false,
} as const

export async function scoreOffre(
  anthropic: Anthropic,
  intitule: string,
  offre: { titre: string; description: string | null },
): Promise<number> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 64,
    output_config: { format: { type: 'json_schema', schema: SCORE_SCHEMA } },
    messages: [
      {
        role: 'user',
        content:
          `Note de 0 à 100 la pertinence de cette offre pour la recherche "${intitule}".\n` +
          `Offre : ${offre.titre}\n${offre.description ?? ''}\n` +
          `Réponds uniquement avec un entier score entre 0 et 100.`,
      },
    ],
  })
  const block = res.content.find((b: any) => b.type === 'text') as any
  const raw = Number(JSON.parse(block?.text ?? '{}').score ?? 0)
  // Le schéma JSON ne peut pas contraindre min/max : on borne ici.
  return Math.max(0, Math.min(100, Math.round(raw)))
}

type Deps = { anthropic?: Anthropic; scoreOffre?: typeof scoreOffre }

export async function scoreNouvellesOffres(
  client: SupabaseClient,
  rechercheId: string,
  intitule: string,
  deps: Deps = {},
): Promise<number> {
  const anthropic = deps.anthropic ?? new Anthropic()
  const scorer = deps.scoreOffre ?? scoreOffre

  const { data, error } = await client
    .from('resultats')
    .select('offre_id, offres(titre, description)')
    .eq('recherche_id', rechercheId)
    .is('score_pertinence', null)
  if (error) throw error

  let n = 0
  for (const row of (data ?? []) as any[]) {
    const offre = row.offres
    if (!offre) continue
    const score = await scorer(anthropic, intitule, offre)
    const { error: upErr } = await client
      .from('resultats')
      .update({ score_pertinence: score })
      .eq('recherche_id', rechercheId)
      .eq('offre_id', row.offre_id)
    if (upErr) throw upErr
    n += 1
  }
  return n
}
