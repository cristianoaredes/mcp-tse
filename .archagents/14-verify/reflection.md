# Reflection — 2026-11-23

> Gerado em 2026-11-23T20:31:27Z por `scripts/reflect.py` (TCK-0111).
> **INVARIANTE:** recomendações viram TICKET ou proposta de heurística — NUNCA auto-edição de prompt.

## Métricas

### Learning Log (`_meta.json`)
- Total de entradas: **0**
- Sucessos: 0 | Falhas: 0
- Taxa de sucesso: **0.0%**
- Cycle time: dados insuficientes (< 2 timestamps)

### Verify Reports (`14-verify/reports/`)
- Total de VERs: **5**
- Aprovados: 5 | Rejeitados: 0 | Com notas: 2
- Taxa de rejeição: **0.0%**
- Follow-ups latentes encontrados: 0
- Ignorados por frontmatter inválido (skipped_invalid): **0**

### Memória coletiva (`99-memory/` — TCK-0590)
- Lessons (canônico JSON): **0** | SQLite derivado: 1
- Pattern registry (LRN): **0** | anti-patterns: 0 | telemetry-insights: 0
- Verdicts vivos: **4** | quarentena era-cega (TCK-0588): 0

### Orquestração (TCK-0179)
- Misroute rate: **0.0%** (0/0 decisões) — cobertura: n/a (sem eventos route)
- Loop-stall rate: **0.0%** (0/3 runs que iteraram) — cobertura: 3 run(s) com attempt_count>=1
- Council tie/flakiness: **0.0%** (0/0 councils) — cobertura: n/a (sem eventos council)

### Loop Health (SPC-0028)
- Loop quality: **50.0%** (5 runs)
- Lesson utility (média): 0.0 — 0 run(s) com outcome de juiz; 0 consultaram lições
- Loop stall rate: 0.0%
- Estratégia mais efetiva: `default`
- Custo médio por run: $0.0 (0 run(s) com custo medido)

### Autonomia (KPIs BRF-0020 / C1.4)
- verified_done_rate: **100.0%** (5/5 done com VER) — cobertura: ok
- verified_done_rate (coorte ver_required): **100.0%** (2/2 done-M+/high/security com VER) — gate Fase B PLN-0009: ≥80% neste coorte (não no global)
- criteria_verified_rate (tier mecânico, lock): **100.0%** (5/5) — NÃO gateia Fase B; complementa o verified_done_rate adversarial — cobertura: lower-bound (lock desde 2026-07-03)
- done_proof (SPC-0103): **5/5** verificados | passes_false=0 | ran_never=0 | side_door=0
- human_touch_rate: **0.0%** (0/5 runs com pausa) — cobertura: ok

### Rework (TCK-0528)
- reopened_rate: **0.0%** (0/5 done que voltaram a ativo) — cobertura: ok
- escaped defects abertos ([adversarial-resample]): **0**
- regression catalog: 0 entrada(s)
- churn pós-merge: `not_measured` (sem fonte confiável ainda — não finge número)

### Custo por ticket (perfil: anthropic)
- Custo total da janela: **$3.0682** | Médio: **$0.6136** | Mediana: **$0.1779** (sobre 5 ticket(s) done medido(s))
- Top-3 mais caros: `TCK-0001` ($2.3886, estimated), `TCK-0002` ($0.3848, estimated), `TCK-0003` ($0.1779, estimated)
- Tickets done sem custo atribuível (`tickets_not_measured`): **0** (honestidade do denominador — SPC-0059)
- _nota: valor(es) com fonte `estimated` (fallback `token-report --source artifacts` e/ou rateio igual de onda multi-ticket) — lower bound, não custo exato._

## Padrões observados

- Taxa de sucesso baixa (<70%): revisar gates de entrada (DoR) e critérios de verify.

## Custo

*Seção omitida: `_token-usage.json` não encontrado. Rode `python3 scripts/token-report.py --write-cache` para gerar.*

## Recomendações

**INVARIANTE:** cada recomendação abaixo deve virar um **TICKET** (via `/ops-work` intake) ou uma **proposta de heurística** — NUNCA auto-edição silenciosa de prompt ou gate.

- `→ ticket` — learning_log vazio: verificar se update-meta.py está sendo chamado após cada verify.
- `→ ticket` — Cobertura de lições baixa: apenas 0/5 runs (0.0%) têm lessons_consulted não-vazio. Verificar wiring do TCK-0488 e rebuild do índice SQLite (W3/PLN-0011).
- `→ ticket` — Loop quality 50.0% (< 70%) — convergência abaixo do target. Verificar lesson coverage (W3/PLN-0011) e estratégia de loop em select_loop_strategy.

---
*Reflection gerado em 2026-11-23T20:31:27Z. Próxima execução: sob demanda ou por-fase via `/ops-reflect`.*
