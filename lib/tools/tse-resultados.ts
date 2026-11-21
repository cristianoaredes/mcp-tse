/**
 * TSE Resultados (EA20 static JSON) tools — Worker-safe (zero `node:*` imports).
 * Covers:
 * - tse_eleicoes_catalogo (comum/config/ele-c.json)
 * - tse_municipios_zonas (mun-e*-cm.json)
 * - tse_apuracao_cargo (-u.json)
 * - tse_candidatos_busca (-u.json)
 * - tse_partidos_federacoes (-u.json)
 * - tse_comparecimento_abstencao (-ab.json)
 */

import { httpJson } from "../core/http-client.js";
import { hasTool, registerTool, type ToolHandler } from "../core/registry.js";
import {
  sanitizeUntrustedText,
  UNTRUSTED_EXTERNAL_DATA_NOTICE,
} from "../shared/agentic-guard.js";
import { attachLgpdNotice } from "../shared/compliance-notices.js";
import {
  TSE_CARGO_CODES,
  TSE_CARGOS,
  TseApuracaoCargoInput,
  TseApuracaoCargoSchema,
  TseCandidatosBuscaInput,
  TseCandidatosBuscaSchema,
  TseCargo,
  TseComparecimentoAbstencaoInput,
  TseComparecimentoAbstencaoSchema,
  TseEleicoesCatalogoInput,
  TseEleicoesCatalogoSchema,
  TseMunicipiosZonasInput,
  TseMunicipiosZonasSchema,
  TsePartidosFederacoesInput,
  TsePartidosFederacoesSchema,
} from "../shared/tse-schemas.js";
import { ApiConfig, Cache, LookupResult } from "../types/index.js";

const MAX_AB_RETURNED = 100;

interface EleicaoCatalogItem {
  codigo_pleito: string;
  ciclo: string;
  data_eleicao: string;
  ano: number | null;
  codigo_eleicao: string;
  codigo_segundo_turno: string | null;
  nome: string;
  turno: string;
  tipo_codigo: string;
  tipo: "ordinaria" | "suplementar" | "consulta_ou_outro";
  abrangencias: string[];
  cargos: Array<{ codigo: string; descricao: string }>;
}

interface MunicipioZonaItem {
  codigo_tse: string;
  codigo_ibge: string;
  nome: string;
  uf: string;
  capital: boolean;
  zonas_eleitorais: string[];
}

interface ViceSuplenteItem {
  tipo: string;
  sq_candidato: string;
  nome: string;
  nome_urna: string;
  partido: string;
}

interface CandidatoItem {
  numero: string;
  sq_candidato: string;
  nome: string;
  nome_urna: string;
  partido: string;
  numero_partido: string;
  coligacao: string;
  federacao_codigo: string | null;
  eleito: boolean;
  situacao: string;
  destinacao_voto: string;
  votos: number;
  pct_votos_validos: string;
  vices_suplentes: ViceSuplenteItem[];
}

interface PartidoResumoItem {
  numero: string;
  sigla: string;
  nome: string;
  federacao_codigo: string | null;
  coligacao: string;
  tvtn: number;
  tvan: number;
  votos_legenda: number;
  total_candidatos: number;
  total_eleitos: number;
}

interface FederacaoItem {
  codigo: string;
  sigla: string;
  nome: string;
  composicao: string;
  numeros_partidos: string[];
}

interface Ea20CargoLoaded {
  ciclo: string;
  codigo_eleicao: string;
  cargo: TseCargo;
  uf: string;
  codigo_tse_municipio?: string;
  cargo_nome: string;
  data_geracao: string;
  hora_geracao: string;
  andamento: string;
  secoes: {
    total: number;
    totalizadas: number;
    pct_totalizadas: string;
    nao_totalizadas: number;
    instaladas: number;
    apuradas: number;
  };
  eleitorado: {
    aptos: number;
    comparecimento: number;
    pct_comparecimento: string;
    abstencao: number;
    pct_abstencao: string;
  };
  votos: {
    total: number;
    validos: number;
    pct_validos: string;
    nominais: number;
    brancos: number;
    pct_brancos: string;
    nulos: number;
    pct_nulos: string;
    anulados_sub_judice: number;
  };
  candidatos: CandidatoItem[];
  partidos: PartidoResumoItem[];
  federacoes: FederacaoItem[];
  source_url: string;
}

interface AbrangenciaAbstencaoItem {
  tpabr: string;
  cdabr: string;
  andamento: string;
  dt: string;
  ht: string;
  s: {
    ts: number;
    st: number;
    pst: string;
    snt: number;
    si: number;
    sa: number;
  };
  e: {
    te: number;
    c: number;
    pc: string;
    a: number;
    pa: string;
  };
}

interface CachedAbstencaoPayload {
  eleicao: string;
  turno: string;
  dg: string;
  hg: string;
  abr: AbrangenciaAbstencaoItem[];
  source_url: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeText(value: unknown, maxChars: number = 200): string {
  if (value === null || value === undefined) return "";
  return sanitizeUntrustedText(typeof value === "string" ? value : String(value), maxChars);
}

function toInt(value: unknown): number {
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function padEleicao(codigo: string): string {
  return codigo.padStart(6, "0");
}

function extractYearFromPleito(dt: string, ciclo: string): number | null {
  const dtMatch = /(\d{4})$/.exec(dt.trim());
  if (dtMatch) {
    const parsed = Number.parseInt(dtMatch[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  const cicloMatch = /(\d{4})/.exec(ciclo);
  if (cicloMatch) {
    const parsed = Number.parseInt(cicloMatch[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function classifyElectionType(
  nome: string,
  tp: string,
): "ordinaria" | "suplementar" | "consulta_ou_outro" {
  const norm = normalizeSearchText(nome);
  if (norm.includes("suplementar") || tp === "4") {
    return "suplementar";
  }
  if (norm.includes("ordinaria") || tp === "1" || tp === "3" || tp === "8") {
    return "ordinaria";
  }
  return "consulta_ou_outro";
}

// ─── Tool 1: tse_eleicoes_catalogo ──────────────────────────────────────────

export async function executeEleicoesCatalogo(
  args: TseEleicoesCatalogoInput,
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<LookupResult> {
  const parsed = TseEleicoesCatalogoSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid parameters for tse_eleicoes_catalogo: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const { ano, tipo, uf, limit } = parsed.data;
  const url = `${apiConfig.resultadosBaseUrl}comum/config/ele-c.json`;
  const cacheKey = `tse:ele-c:${apiConfig.resultadosBaseUrl}`;

  let catalogItems: EleicaoCatalogItem[] | null = null;
  let fromCache = false;

  if (cache) {
    const cached = await cache.get<EleicaoCatalogItem[]>(cacheKey);
    if (Array.isArray(cached)) {
      catalogItems = cached;
      fromCache = true;
    }
  }

  if (!catalogItems) {
    const res = await httpJson(url, apiConfig.authHeaders);
    if (!res.ok) {
      return { ok: false, error: `TSE Resultados API error: ${res.error || "request failed"}` };
    }

    const root = asRecord(res.data);
    if (!root || !Array.isArray(root.pl)) {
      return {
        ok: false,
        error: "TSE Resultados API error: unexpected ele-c.json response format",
      };
    }

    const flattened: EleicaoCatalogItem[] = [];
    for (const rawPleito of root.pl) {
      const pleito = asRecord(rawPleito);
      if (!pleito || !Array.isArray(pleito.e)) continue;

      const codigoPleito = safeText(pleito.cd, 20);
      const ciclo = safeText(pleito.c, 20);
      const dataEleicao = safeText(pleito.dt, 20);
      const anoPleito = extractYearFromPleito(dataEleicao, ciclo);

      for (const rawEle of pleito.e) {
        const ele = asRecord(rawEle);
        if (!ele) continue;
        const nome = safeText(ele.nm, 250);
        const tipoCodigo = safeText(ele.tp, 10);
        const rawAbr = Array.isArray(ele.abr) ? ele.abr : [];
        const abrangencias: string[] = [];
        const cargosMap = new Map<string, string>();

        for (const rawA of rawAbr) {
          const a = asRecord(rawA);
          if (!a) continue;
          const cd = safeText(a.cd, 10).toLowerCase();
          if (cd && !abrangencias.includes(cd)) {
            abrangencias.push(cd);
          }
          if (Array.isArray(a.cp)) {
            for (const rawCp of a.cp) {
              const cp = asRecord(rawCp);
              if (!cp) continue;
              const cpCd = safeText(cp.cd, 10);
              const cpDs = safeText(cp.ds, 160);
              if (cpCd && !cargosMap.has(cpCd)) {
                cargosMap.set(cpCd, cpDs);
              }
            }
          }
        }

        const cdt2 = safeText(ele.cdt2, 20);
        flattened.push({
          codigo_pleito: codigoPleito,
          ciclo,
          data_eleicao: dataEleicao,
          ano: anoPleito,
          codigo_eleicao: safeText(ele.cd, 20),
          codigo_segundo_turno: cdt2.length > 0 ? cdt2 : null,
          nome,
          turno: safeText(ele.t, 4),
          tipo_codigo: tipoCodigo,
          tipo: classifyElectionType(nome, tipoCodigo),
          abrangencias,
          cargos: Array.from(cargosMap.entries()).map(([codigo, descricao]) => ({
            codigo,
            descricao,
          })),
        });
      }
    }

    catalogItems = flattened;
    if (cache) {
      await cache.set(cacheKey, catalogItems);
    }
  }

  const filtered = catalogItems.filter((item) => {
    if (ano !== undefined && item.ano !== ano) {
      return false;
    }
    if (tipo === "ordinaria" && item.tipo !== "ordinaria") {
      return false;
    }
    if (tipo === "suplementar" && item.tipo !== "suplementar") {
      return false;
    }
    if (uf !== undefined) {
      const hasExact = item.abrangencias.includes(uf);
      const hasBr = uf !== "br" && item.abrangencias.includes("br");
      if (!hasExact && !hasBr) {
        return false;
      }
    }
    return true;
  });

  const returned = filtered.slice(0, limit);
  const fetchedAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      total_matches: filtered.length,
      returned: returned.length,
      filters: {
        ...(ano !== undefined ? { ano } : {}),
        tipo,
        ...(uf !== undefined ? { uf } : {}),
        limit,
      },
      eleicoes: returned,
      cached: fromCache,
      source: "TSE Resultados — Catálogo de Eleições (ele-c.json)",
      source_url: url,
      fetchedAt,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    },
    source: { url, fetchedAt },
  };
}

// ─── Tool 2: tse_municipios_zonas ───────────────────────────────────────────

export async function executeMunicipiosZonas(
  args: TseMunicipiosZonasInput,
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<LookupResult> {
  const parsed = TseMunicipiosZonasSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid parameters for tse_municipios_zonas: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const { ciclo, codigo_eleicao, uf, codigo_ibge, codigo_tse, nome, limit } = parsed.data;
  const ele6 = padEleicao(codigo_eleicao);
  const url = `${apiConfig.resultadosBaseUrl}${ciclo}/${codigo_eleicao}/config/mun-e${ele6}-cm.json`;
  const cacheKey = `tse:mun:${apiConfig.resultadosBaseUrl}:${ciclo}:${ele6}`;

  let allMunicipalities: MunicipioZonaItem[] | null = null;
  let fromCache = false;

  if (cache) {
    const cached = await cache.get<MunicipioZonaItem[]>(cacheKey);
    if (Array.isArray(cached)) {
      allMunicipalities = cached;
      fromCache = true;
    }
  }

  if (!allMunicipalities) {
    const res = await httpJson(url, apiConfig.authHeaders);
    if (!res.ok) {
      return { ok: false, error: `TSE Resultados API error: ${res.error || "request failed"}` };
    }

    const root = asRecord(res.data);
    if (!root || !Array.isArray(root.abr)) {
      return {
        ok: false,
        error: "TSE Resultados API error: unexpected mun-e*-cm.json response format",
      };
    }

    const items: MunicipioZonaItem[] = [];
    for (const rawAbr of root.abr) {
      const abr = asRecord(rawAbr);
      if (!abr || !Array.isArray(abr.mu)) continue;
      const abrUf = safeText(abr.cd, 8).toUpperCase();

      for (const rawMu of abr.mu) {
        const mu = asRecord(rawMu);
        if (!mu) continue;
        const zonas = Array.isArray(mu.z)
          ? mu.z.map((z) => safeText(z, 12)).filter((z) => z.length > 0)
          : [];

        items.push({
          codigo_tse: safeText(mu.cd, 10),
          codigo_ibge: safeText(mu.cdi, 12),
          nome: safeText(mu.nm, 200),
          uf: abrUf,
          capital: mu.c === "s",
          zonas_eleitorais: zonas,
        });
      }
    }

    allMunicipalities = items;
    if (cache) {
      await cache.set(cacheKey, allMunicipalities);
    }
  }

  const normNome = nome ? normalizeSearchText(nome) : undefined;
  const filtered = allMunicipalities.filter((m) => {
    if (uf && m.uf.toLowerCase() !== uf) return false;
    if (codigo_ibge && m.codigo_ibge !== codigo_ibge) return false;
    if (codigo_tse && m.codigo_tse !== codigo_tse) return false;
    if (normNome && !normalizeSearchText(m.nome).includes(normNome)) return false;
    return true;
  });

  const returned = filtered.slice(0, limit);
  const fetchedAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      ciclo,
      codigo_eleicao,
      total_matches: filtered.length,
      returned: returned.length,
      municipios: returned,
      cached: fromCache,
      source: "TSE Resultados — Municípios e Zonas Eleitorais (EA20)",
      source_url: url,
      fetchedAt,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    },
    source: { url, fetchedAt },
  };
}

// ─── Shared EA20 -u.json loader for Tools 3, 4, 5 ───────────────────────────

async function loadEa20CargoData(
  params: {
    ciclo: string;
    codigo_eleicao: string;
    cargo: TseCargo;
    uf?: string;
    codigo_tse_municipio?: string;
  },
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<{ ok: true; data: Ea20CargoLoaded; cached: boolean } | { ok: false; error: string }> {
  const { ciclo, codigo_eleicao, cargo, codigo_tse_municipio } = params;
  const scopeUf = params.uf ?? "br";
  const ele6 = padEleicao(codigo_eleicao);
  const cargoCode = TSE_CARGO_CODES[cargo];
  const prefix = codigo_tse_municipio ? `${scopeUf}${codigo_tse_municipio}` : scopeUf;
  const url = `${apiConfig.resultadosBaseUrl}${ciclo}/${codigo_eleicao}/dados/${scopeUf}/${prefix}-c${cargoCode}-e${ele6}-u.json`;
  const cacheKey = `tse:ea20-u:${apiConfig.resultadosBaseUrl}:${ciclo}:${ele6}:${cargoCode}:${prefix}`;

  if (cache) {
    const cached = await cache.get<Ea20CargoLoaded>(cacheKey);
    if (cached && typeof cached === "object" && Array.isArray(cached.candidatos)) {
      return { ok: true, data: cached, cached: true };
    }
  }

  const res = await httpJson(url, apiConfig.authHeaders);
  if (!res.ok) {
    return { ok: false, error: `TSE Resultados API error: ${res.error || "request failed"}` };
  }

  const root = asRecord(res.data);
  if (!root || !Array.isArray(root.carg) || root.carg.length === 0) {
    return {
      ok: false,
      error: "TSE Resultados API error: unexpected EA20 -u.json response format",
    };
  }

  const carg0 = asRecord(root.carg[0]);
  if (!carg0 || !Array.isArray(carg0.agr)) {
    return {
      ok: false,
      error: "TSE Resultados API error: missing carg[0].agr in EA20 -u.json",
    };
  }

  const s = asRecord(root.s);
  const e = asRecord(root.e);
  const v = asRecord(root.v);

  const candidatos: CandidatoItem[] = [];
  const partidos: PartidoResumoItem[] = [];

  for (const rawAgr of carg0.agr) {
    const agr = asRecord(rawAgr);
    if (!agr || !Array.isArray(agr.par)) continue;
    const coligacao = safeText(agr.nm ?? agr.com, 200);

    for (const rawPar of agr.par) {
      const par = asRecord(rawPar);
      if (!par) continue;

      const numeroPartido = safeText(par.n, 10);
      const siglaPartido = safeText(par.sg, 30);
      const nomePartido = safeText(par.nm, 200);
      const federacaoCodigo = safeText(par.nfed, 20) || null;
      const rawCandList = Array.isArray(par.cand) ? par.cand : [];

      let totalEleitos = 0;
      for (const rawCand of rawCandList) {
        const cand = asRecord(rawCand);
        if (!cand) continue;

        const eleito = cand.e === "s";
        if (eleito) totalEleitos += 1;

        const rawVs = Array.isArray(cand.vs) ? cand.vs : [];
        const vicesSuplentes: ViceSuplenteItem[] = [];
        for (const entry of rawVs) {
          const vs = asRecord(entry);
          if (!vs) continue;
          vicesSuplentes.push({
            tipo: safeText(vs.tp, 16),
            sq_candidato: safeText(vs.sqcand, 32),
            nome: safeText(vs.nm, 200),
            nome_urna: safeText(vs.nmu, 200),
            partido: safeText(vs.sgp, 30),
          });
        }

        candidatos.push({
          numero: safeText(cand.n, 16),
          sq_candidato: safeText(cand.sqcand, 32),
          nome: safeText(cand.nm, 200),
          nome_urna: safeText(cand.nmu, 200),
          partido: siglaPartido,
          numero_partido: numeroPartido,
          coligacao,
          federacao_codigo: federacaoCodigo,
          eleito,
          situacao: safeText(cand.st, 80),
          destinacao_voto: safeText(cand.dvt, 80),
          votos: toInt(cand.vap),
          pct_votos_validos: safeText(cand.pvap ?? "0,00", 16),
          vices_suplentes: vicesSuplentes,
        });
      }

      partidos.push({
        numero: numeroPartido,
        sigla: siglaPartido,
        nome: nomePartido,
        federacao_codigo: federacaoCodigo,
        coligacao,
        tvtn: toInt(par.tvtn),
        tvan: toInt(par.tvan),
        votos_legenda: toInt(par.tvtl ?? par.tval ?? 0),
        total_candidatos: rawCandList.length,
        total_eleitos: totalEleitos,
      });
    }
  }

  candidatos.sort((a, b) => {
    if (b.votos !== a.votos) return b.votos - a.votos;
    return a.nome_urna.localeCompare(b.nome_urna);
  });

  partidos.sort((a, b) => {
    const totalB = b.tvtn + b.votos_legenda;
    const totalA = a.tvtn + a.votos_legenda;
    if (totalB !== totalA) return totalB - totalA;
    if (b.tvan !== a.tvan) return b.tvan - a.tvan;
    return b.total_eleitos - a.total_eleitos;
  });

  const rawFedList = Array.isArray(carg0.fed) ? carg0.fed : [];
  const federacoes: FederacaoItem[] = [];
  for (const rawFed of rawFedList) {
    const fed = asRecord(rawFed);
    if (!fed) continue;
    federacoes.push({
      codigo: safeText(fed.n, 20),
      sigla: safeText(fed.sg, 60),
      nome: safeText(fed.nm, 200),
      composicao: safeText(fed.com, 120),
      numeros_partidos: Array.isArray(fed.npar)
        ? fed.npar.map((n) => safeText(n, 10)).filter((n) => n.length > 0)
        : [],
    });
  }

  const loaded: Ea20CargoLoaded = {
    ciclo,
    codigo_eleicao,
    cargo,
    uf: scopeUf,
    ...(codigo_tse_municipio ? { codigo_tse_municipio } : {}),
    cargo_nome: safeText(carg0.nmn ?? carg0.nmm ?? cargo, 120),
    data_geracao: safeText(root.dg ?? root.dt, 20),
    hora_geracao: safeText(root.hg ?? root.ht, 20),
    andamento: safeText(root.and, 16),
    secoes: {
      total: toInt(s?.ts),
      totalizadas: toInt(s?.st),
      pct_totalizadas: safeText(s?.pst ?? "0,00", 16),
      nao_totalizadas: toInt(s?.snt),
      instaladas: toInt(s?.si),
      apuradas: toInt(s?.sa),
    },
    eleitorado: {
      aptos: toInt(e?.te),
      comparecimento: toInt(e?.c),
      pct_comparecimento: safeText(e?.pc ?? "0,00", 16),
      abstencao: toInt(e?.a),
      pct_abstencao: safeText(e?.pa ?? "0,00", 16),
    },
    votos: {
      total: toInt(v?.tv),
      validos: toInt(v?.vv),
      pct_validos: safeText(v?.pvv ?? "0,00", 16),
      nominais: toInt(v?.vnom),
      brancos: toInt(v?.vb),
      pct_brancos: safeText(v?.pvb ?? "0,00", 16),
      nulos: toInt(v?.vn ?? v?.tvn),
      pct_nulos: safeText(v?.ptvn ?? "0,00", 16),
      anulados_sub_judice: toInt(v?.vansj),
    },
    candidatos,
    partidos,
    federacoes,
    source_url: url,
  };

  if (cache) {
    await cache.set(cacheKey, loaded);
  }

  return { ok: true, data: loaded, cached: false };
}

// ─── Tool 3: tse_apuracao_cargo ─────────────────────────────────────────────

export async function executeApuracaoCargo(
  args: TseApuracaoCargoInput,
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<LookupResult> {
  const parsed = TseApuracaoCargoSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid parameters for tse_apuracao_cargo: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const { ciclo, codigo_eleicao, cargo, uf, codigo_tse_municipio, page, limit } = parsed.data;
  const loaded = await loadEa20CargoData(
    { ciclo, codigo_eleicao, cargo, uf, codigo_tse_municipio },
    apiConfig,
    cache,
  );
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const { candidatos, partidos: _partidos, federacoes: _federacoes, ...summary } = loaded.data;
  const total = candidatos.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const pageItems = candidatos.slice(offset, offset + limit);
  const fetchedAt = new Date().toISOString();

  return {
    ok: true,
    data: attachLgpdNotice({
      ...summary,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
      candidatos: pageItems,
      cached: loaded.cached,
      source: "TSE Resultados — Apuração por Cargo (EA20)",
      fetchedAt,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    }),
    source: { url: loaded.data.source_url, fetchedAt },
  };
}

// ─── Tool 4: tse_candidatos_busca ───────────────────────────────────────────

export async function executeCandidatosBusca(
  args: TseCandidatosBuscaInput,
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<LookupResult> {
  const parsed = TseCandidatosBuscaSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid parameters for tse_candidatos_busca: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const {
    ciclo,
    codigo_eleicao,
    cargo,
    uf,
    codigo_tse_municipio,
    nome,
    numero,
    partido,
    apenas_eleitos,
    limit,
  } = parsed.data;

  const loaded = await loadEa20CargoData(
    { ciclo, codigo_eleicao, cargo, uf, codigo_tse_municipio },
    apiConfig,
    cache,
  );
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const normNome = nome ? normalizeSearchText(nome) : undefined;
  const normPartido = partido ? normalizeSearchText(partido) : undefined;

  const matched = loaded.data.candidatos.filter((cand) => {
    if (apenas_eleitos && !cand.eleito) return false;
    if (numero && cand.numero !== numero) return false;
    if (normPartido && normalizeSearchText(cand.partido) !== normPartido) return false;
    if (normNome) {
      const hitMain =
        normalizeSearchText(cand.nome).includes(normNome) ||
        normalizeSearchText(cand.nome_urna).includes(normNome);
      const hitVs = cand.vices_suplentes.some(
        (vs) =>
          normalizeSearchText(vs.nome).includes(normNome) ||
          normalizeSearchText(vs.nome_urna).includes(normNome),
      );
      if (!hitMain && !hitVs) return false;
    }
    return true;
  });

  const returned = matched.slice(0, limit);
  const fetchedAt = new Date().toISOString();

  return {
    ok: true,
    data: attachLgpdNotice({
      ciclo: loaded.data.ciclo,
      codigo_eleicao: loaded.data.codigo_eleicao,
      cargo: loaded.data.cargo,
      cargo_nome: loaded.data.cargo_nome,
      uf: loaded.data.uf,
      ...(loaded.data.codigo_tse_municipio
        ? { codigo_tse_municipio: loaded.data.codigo_tse_municipio }
        : {}),
      total_matches: matched.length,
      returned: returned.length,
      candidatos: returned,
      cached: loaded.cached,
      source: "TSE Resultados — Busca de Candidatos (EA20)",
      source_url: loaded.data.source_url,
      fetchedAt,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    }),
    source: { url: loaded.data.source_url, fetchedAt },
  };
}

// ─── Tool 5: tse_partidos_federacoes ────────────────────────────────────────

export async function executePartidosFederacoes(
  args: TsePartidosFederacoesInput,
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<LookupResult> {
  const parsed = TsePartidosFederacoesSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid parameters for tse_partidos_federacoes: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const { ciclo, codigo_eleicao, cargo, uf, codigo_tse_municipio, partido, limit } = parsed.data;
  const loaded = await loadEa20CargoData(
    { ciclo, codigo_eleicao, cargo, uf, codigo_tse_municipio },
    apiConfig,
    cache,
  );
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const normPartido = partido ? normalizeSearchText(partido) : undefined;
  const filteredPartidos = normPartido
    ? loaded.data.partidos.filter(
        (p) =>
          normalizeSearchText(p.sigla) === normPartido ||
          normalizeSearchText(p.nome).includes(normPartido) ||
          p.numero === partido,
      )
    : loaded.data.partidos;

  const filteredFederacoes = normPartido
    ? loaded.data.federacoes.filter(
        (f) =>
          normalizeSearchText(f.sigla).includes(normPartido) ||
          normalizeSearchText(f.nome).includes(normPartido) ||
          f.numeros_partidos.includes(partido!),
      )
    : loaded.data.federacoes;

  const returnedPartidos = filteredPartidos.slice(0, limit);
  const fetchedAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      ciclo: loaded.data.ciclo,
      codigo_eleicao: loaded.data.codigo_eleicao,
      cargo: loaded.data.cargo,
      cargo_nome: loaded.data.cargo_nome,
      uf: loaded.data.uf,
      ...(loaded.data.codigo_tse_municipio
        ? { codigo_tse_municipio: loaded.data.codigo_tse_municipio }
        : {}),
      total_federacoes: filteredFederacoes.length,
      federacoes: filteredFederacoes,
      total_partidos: filteredPartidos.length,
      returned_partidos: returnedPartidos.length,
      partidos: returnedPartidos,
      cached: loaded.cached,
      source: "TSE Resultados — Partidos e Federações (EA20)",
      source_url: loaded.data.source_url,
      fetchedAt,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    },
    source: { url: loaded.data.source_url, fetchedAt },
  };
}

// ─── Tool 6: tse_comparecimento_abstencao ───────────────────────────────────

function formatPercentPtBr(part: number, total: number): string {
  if (total <= 0) return "0,00";
  return ((part / total) * 100).toFixed(2).replace(".", ",");
}

export async function executeComparecimentoAbstencao(
  args: TseComparecimentoAbstencaoInput,
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<LookupResult> {
  const parsed = TseComparecimentoAbstencaoSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid parameters for tse_comparecimento_abstencao: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const { ciclo, codigo_eleicao, uf, codigo_tse_municipio } = parsed.data;
  const ele6 = padEleicao(codigo_eleicao);
  const url = `${apiConfig.resultadosBaseUrl}${ciclo}/${codigo_eleicao}/dados/${uf}/${uf}-e${ele6}-ab.json`;
  const cacheKey = `tse:ea20-ab:${apiConfig.resultadosBaseUrl}:${ciclo}:${ele6}:${uf}`;

  let payload: CachedAbstencaoPayload | null = null;
  let fromCache = false;

  if (cache) {
    const cached = await cache.get<CachedAbstencaoPayload>(cacheKey);
    if (cached && typeof cached === "object" && Array.isArray(cached.abr)) {
      payload = cached;
      fromCache = true;
    }
  }

  if (!payload) {
    const res = await httpJson(url, apiConfig.authHeaders);
    if (!res.ok) {
      return { ok: false, error: `TSE Resultados API error: ${res.error || "request failed"}` };
    }

    const root = asRecord(res.data);
    if (!root || !Array.isArray(root.abr)) {
      return {
        ok: false,
        error: "TSE Resultados API error: unexpected EA20 -ab.json response format",
      };
    }

    const abrItems: AbrangenciaAbstencaoItem[] = [];
    for (const rawEntry of root.abr) {
      const entry = asRecord(rawEntry);
      if (!entry) continue;
      const s = asRecord(entry.s);
      const e = asRecord(entry.e);
      abrItems.push({
        tpabr: safeText(entry.tpabr, 16),
        cdabr: safeText(entry.cdabr, 16),
        andamento: safeText(entry.and, 16),
        dt: safeText(entry.dt, 20),
        ht: safeText(entry.ht, 20),
        s: {
          ts: toInt(s?.ts),
          st: toInt(s?.st),
          pst: safeText(s?.pst ?? "0,00", 16),
          snt: toInt(s?.snt),
          si: toInt(s?.si),
          sa: toInt(s?.sa),
        },
        e: {
          te: toInt(e?.te),
          c: toInt(e?.c),
          pc: safeText(e?.pc ?? "0,00", 16),
          a: toInt(e?.a),
          pa: safeText(e?.pa ?? "0,00", 16),
        },
      });
    }

    payload = {
      eleicao: safeText(root.ele ?? codigo_eleicao, 20),
      turno: safeText(root.t, 4),
      dg: safeText(root.dg, 20),
      hg: safeText(root.hg, 20),
      abr: abrItems,
      source_url: url,
    };

    if (cache) {
      await cache.set(cacheKey, payload);
    }
  }

  const matched = codigo_tse_municipio
    ? payload.abr.filter((item) => item.cdabr === codigo_tse_municipio)
    : payload.abr;

  if (codigo_tse_municipio && matched.length === 0) {
    return {
      ok: false,
      error: `Municipality ${codigo_tse_municipio} not found in TSE turnout data for UF '${uf}'.`,
    };
  }

  let resumoAgregado: Record<string, unknown> | undefined;
  if (!codigo_tse_municipio && matched.length > 0) {
    // For national ('br') files, the last entry with tpabr === 'br' is already the BR aggregate; sum only 'uf' rows if present.
    const rowsForSum =
      uf === "br" && matched.some((m) => m.tpabr === "uf")
        ? matched.filter((m) => m.tpabr === "uf")
        : matched;
    const totals = rowsForSum.reduce(
      (acc, row) => {
        acc.ts += row.s.ts;
        acc.st += row.s.st;
        acc.te += row.e.te;
        acc.c += row.e.c;
        acc.a += row.e.a;
        return acc;
      },
      { ts: 0, st: 0, te: 0, c: 0, a: 0 },
    );
    resumoAgregado = {
      secoes_total: totals.ts,
      secoes_totalizadas: totals.st,
      eleitores_aptos: totals.te,
      comparecimento: totals.c,
      pct_comparecimento: formatPercentPtBr(totals.c, totals.te),
      abstencao: totals.a,
      pct_abstencao: formatPercentPtBr(totals.a, totals.te),
    };
  }

  const truncated = matched.length > MAX_AB_RETURNED;
  const returnedItems = truncated ? matched.slice(0, MAX_AB_RETURNED) : matched;
  const fetchedAt = new Date().toISOString();

  return {
    ok: true,
    data: {
      ciclo,
      codigo_eleicao: payload.eleicao,
      turno: payload.turno,
      uf,
      ...(codigo_tse_municipio ? { codigo_tse_municipio } : {}),
      data_geracao: payload.dg,
      hora_geracao: payload.hg,
      ...(resumoAgregado ? { resumo_agregado: resumoAgregado } : {}),
      total_abrangencias: matched.length,
      returned: returnedItems.length,
      truncated,
      ...(truncated
        ? {
            truncation_notice: `Showing first ${MAX_AB_RETURNED} of ${matched.length} entries. Provide codigo_tse_municipio to query a specific municipality.`,
          }
        : {}),
      abr: returnedItems,
      cached: fromCache,
      source: "TSE Resultados — Comparecimento e Abstenção (EA20)",
      source_url: url,
      fetchedAt,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    },
    source: { url, fetchedAt },
  };
}

// ─── Tool Handlers & Registration ───────────────────────────────────────────

const scopePropertiesSchema = {
  ciclo: {
    type: "string",
    description: "Electoral cycle identifier (default: 'ele2026')",
    default: "ele2026",
  },
  codigo_eleicao: {
    type: "string",
    description: "Numeric TSE election code (default: '6257')",
    default: "6257",
  },
  cargo: {
    type: "string",
    enum: [...TSE_CARGOS],
    description: "Electoral office",
  },
  uf: {
    type: "string",
    description: "2-letter state UF ('sp', 'rj', 'df', etc.) or 'br' (presidente only)",
  },
  codigo_tse_municipio: {
    type: "string",
    description: "5-digit TSE municipality code (required for prefeito and vereador)",
  },
};

export const TSE_ELEICOES_CATALOGO_TOOL: ToolHandler = {
  name: "tse_eleicoes_catalogo",
  description:
    "List Brazilian electoral cycles, election codes, dates, types (ordinaria/suplementar), UFs, and offices from TSE ele-c.json.",
  inputSchema: {
    type: "object",
    properties: {
      ano: { type: "integer", minimum: 2014, maximum: 2034, description: "Filter by election year" },
      tipo: {
        type: "string",
        enum: ["ordinaria", "suplementar", "todas"],
        default: "todas",
        description: "Filter by election type",
      },
      uf: { type: "string", description: "2-letter UF code or 'br'" },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    },
    additionalProperties: false,
  },
  zodSchema: TseEleicoesCatalogoSchema,
  execute: (args, apiConfig, cache) =>
    executeEleicoesCatalogo(args as TseEleicoesCatalogoInput, apiConfig, cache),
};

export const TSE_MUNICIPIOS_ZONAS_TOOL: ToolHandler = {
  name: "tse_municipios_zonas",
  description:
    "Translate TSE 5-digit municipality codes, IBGE 7-digit codes, names, capitals, and electoral zones from TSE mun-e*-cm.json. Requires at least one filter.",
  inputSchema: {
    type: "object",
    properties: {
      ciclo: { type: "string", default: "ele2024" },
      codigo_eleicao: { type: "string", default: "619" },
      uf: { type: "string", description: "2-letter state UF (different from 'br')" },
      codigo_ibge: { type: "string", description: "7-digit IBGE municipality code" },
      codigo_tse: { type: "string", description: "5-digit TSE municipality code" },
      nome: { type: "string", minLength: 2, description: "Partial municipality name" },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
    },
    additionalProperties: false,
  },
  zodSchema: TseMunicipiosZonasSchema,
  execute: (args, apiConfig, cache) =>
    executeMunicipiosZonas(args as TseMunicipiosZonasInput, apiConfig, cache),
};

export const TSE_APURACAO_CARGO_TOOL: ToolHandler = {
  name: "tse_apuracao_cargo",
  description:
    "Query TSE EA20 section tally, voter turnout summary, and paginated candidate vote rankings for an electoral office.",
  inputSchema: {
    type: "object",
    properties: {
      ...scopePropertiesSchema,
      page: { type: "integer", minimum: 1, maximum: 100, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
    },
    required: ["cargo"],
    additionalProperties: false,
  },
  zodSchema: TseApuracaoCargoSchema,
  execute: (args, apiConfig, cache) =>
    executeApuracaoCargo(args as TseApuracaoCargoInput, apiConfig, cache),
};

export const TSE_CANDIDATOS_BUSCA_TOOL: ToolHandler = {
  name: "tse_candidatos_busca",
  description:
    "Search TSE EA20 candidates (including running mates/substitutes) by name, ballot number, party, or elected status.",
  inputSchema: {
    type: "object",
    properties: {
      ...scopePropertiesSchema,
      nome: { type: "string", minLength: 2, description: "Partial candidate or vice name" },
      numero: { type: "string", description: "2 to 5 digit candidate ballot number" },
      partido: { type: "string", description: "Party acronym (e.g., 'PL', 'PT', 'MDB')" },
      apenas_eleitos: { type: "boolean", default: false },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    },
    required: ["cargo"],
    additionalProperties: false,
  },
  zodSchema: TseCandidatosBuscaSchema,
  execute: (args, apiConfig, cache) =>
    executeCandidatosBusca(args as TseCandidatosBuscaInput, apiConfig, cache),
};

export const TSE_PARTIDOS_FEDERACOES_TOOL: ToolHandler = {
  name: "tse_partidos_federacoes",
  description:
    "Summarize party and federation nominal/legend vote totals and elected candidate counts from TSE EA20 -u.json.",
  inputSchema: {
    type: "object",
    properties: {
      ...scopePropertiesSchema,
      partido: { type: "string", description: "Optional party acronym, name, or number filter" },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
    },
    required: ["cargo"],
    additionalProperties: false,
  },
  zodSchema: TsePartidosFederacoesSchema,
  execute: (args, apiConfig, cache) =>
    executePartidosFederacoes(args as TsePartidosFederacoesInput, apiConfig, cache),
};

export const TSE_COMPARECIMENTO_ABSTENCAO_TOOL: ToolHandler = {
  name: "tse_comparecimento_abstencao",
  description:
    "Fetch TSE EA20 voter turnout, abstention, eligible electorate, and polling section counts by Brazil, UF, or municipality.",
  inputSchema: {
    type: "object",
    properties: {
      ciclo: { type: "string", default: "ele2026" },
      codigo_eleicao: { type: "string", default: "6257" },
      uf: { type: "string", default: "br", description: "2-letter UF or 'br'" },
      codigo_tse_municipio: {
        type: "string",
        description: "Optional 5-digit TSE municipality code (requires 2-letter UF != 'br')",
      },
    },
    additionalProperties: false,
  },
  zodSchema: TseComparecimentoAbstencaoSchema,
  execute: (args, apiConfig, cache) =>
    executeComparecimentoAbstencao(args as TseComparecimentoAbstencaoInput, apiConfig, cache),
};

export function registerTseResultadosTools(): void {
  for (const tool of [
    TSE_ELEICOES_CATALOGO_TOOL,
    TSE_MUNICIPIOS_ZONAS_TOOL,
    TSE_APURACAO_CARGO_TOOL,
    TSE_CANDIDATOS_BUSCA_TOOL,
    TSE_PARTIDOS_FEDERACOES_TOOL,
    TSE_COMPARECIMENTO_ABSTENCAO_TOOL,
  ]) {
    if (!hasTool(tool.name)) {
      registerTool(tool);
    }
  }
}
