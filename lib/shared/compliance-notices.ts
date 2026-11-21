/**
 * LGPD compliance notices for nominal electoral lookups.
 * Web-standard module (zero Node-only imports) for Worker compatibility.
 */

export const HOMONYM_HUMAN_REVIEW_NOTICE =
  "LGPD Art. 20 Notice (Revisão Humana Obrigatória): Name-based and partial-text electoral lookups carry risk of homonyms (homônimos), judicial status revisions, or incomplete upstream totals. Do not use this result for automated decisions without prior human review, candidate ID (sq_candidato) verification, and direct confirmation against official TSE sources.";

/**
 * Attach `lgpd_notice` to plain-object payloads while preserving all existing keys.
 */
export function attachLgpdNotice(payload: unknown): unknown {
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      lgpd_notice: HOMONYM_HUMAN_REVIEW_NOTICE,
    };
  }
  return payload;
}
