# Observability Dashboard — SLO/health (TCK-0995)

generated_at: 2026-11-23T20:31:27.967056+00:00

Fonte: `lib.reflect_aggregators._collect_metrics` (mesma agregação de `reflect.py`) — este dashboard REUSA métricas, nunca recomputa. Fail-open (TCK-0541): cobertura `no_data`/valor `None` -> `n/a`, nunca conta como fail.

## SLOs

| SLO | alvo | atual | status | cobertura |
|---|---|---|---|---|
| verified_done_rate (ver_required) | ≥ 80% | 100.0% | ✅ pass | ok |
| escaped defects (open) | == 0 | 0 | ✅ pass | ok |
| reopened_rate | < 5% | 0.0% | ✅ pass | ok |
| loop_stall_rate | < 20% | 0.0% | ✅ pass | ok |
| loop_quality (informativo) | ≥ 70% | 50.0% | ⚠️ warn | ok |

## Loop health

- loop_quality: 50.0
- lesson_utility_avg: 0.0 (sobre 0 run(s) com outcome de juiz)
- runs que consultaram lições: 0
- best_strategy: default
- loop_stall_rate: 0.0

## Janela de custo

- sem dados de custo (`_token-usage.json` ausente/inválido)

