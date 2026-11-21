/**
 * Runtime Zod validation schemas for all 7 registered TSE MCP tools.
 * Imports strictly from lib/shared/ to keep lib/core -> lib/tools acyclic.
 */

import type { ZodType } from "zod";
import {
  TseEleicoesCatalogoSchema,
  TseMunicipiosZonasSchema,
  TseApuracaoCargoSchema,
  TseCandidatosBuscaSchema,
  TsePartidosFederacoesSchema,
  TseComparecimentoAbstencaoSchema,
  TseDadosAbertosDatasetsSchema,
  TSE_CARGOS,
  TSE_CARGO_CODES,
} from "../shared/tse-schemas.js";

export {
  TseEleicoesCatalogoSchema,
  TseMunicipiosZonasSchema,
  TseApuracaoCargoSchema,
  TseCandidatosBuscaSchema,
  TsePartidosFederacoesSchema,
  TseComparecimentoAbstencaoSchema,
  TseDadosAbertosDatasetsSchema,
  TSE_CARGOS,
  TSE_CARGO_CODES,
};

export const TOOL_SCHEMAS: Record<string, ZodType> = {
  tse_eleicoes_catalogo: TseEleicoesCatalogoSchema,
  tse_municipios_zonas: TseMunicipiosZonasSchema,
  tse_apuracao_cargo: TseApuracaoCargoSchema,
  tse_candidatos_busca: TseCandidatosBuscaSchema,
  tse_partidos_federacoes: TsePartidosFederacoesSchema,
  tse_comparecimento_abstencao: TseComparecimentoAbstencaoSchema,
  tse_dados_abertos_datasets: TseDadosAbertosDatasetsSchema,
};
