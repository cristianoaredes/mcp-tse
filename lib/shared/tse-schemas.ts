/**
 * Zod .strict() validation schemas for all 7 TSE MCP tools.
 * Web-standard module (zero Node-only imports) shared across core, tools, and Workers.
 */

import { z, type RefinementCtx } from "zod";

export const TSE_CARGOS = [
  "presidente",
  "governador",
  "senador",
  "deputado_federal",
  "deputado_estadual",
  "deputado_distrital",
  "prefeito",
  "vereador",
] as const;

export type TseCargo = (typeof TSE_CARGOS)[number];

export const TSE_CARGO_CODES: Record<TseCargo, string> = {
  presidente: "0001",
  governador: "0003",
  senador: "0005",
  deputado_federal: "0006",
  deputado_estadual: "0007",
  deputado_distrital: "0008",
  prefeito: "0011",
  vereador: "0013",
};

const MUNICIPAL_CARGOS = new Set<TseCargo>(["prefeito", "vereador"]);
const STATE_CARGOS = new Set<TseCargo>([
  "governador",
  "senador",
  "deputado_federal",
  "deputado_estadual",
  "deputado_distrital",
]);

interface CargoElectionDefaults {
  ciclo: string;
  codigoEleicao: string;
}

const DEFAULT_ELECTION_BY_CARGO_GROUP: Record<
  "municipal" | "state" | "federal",
  CargoElectionDefaults
> = {
  municipal: { ciclo: "ele2024", codigoEleicao: "619" },
  state: { ciclo: "ele2026", codigoEleicao: "6259" },
  federal: { ciclo: "ele2026", codigoEleicao: "6257" },
};

function getCargoElectionDefaults(cargo: TseCargo): CargoElectionDefaults {
  if (MUNICIPAL_CARGOS.has(cargo)) {
    return DEFAULT_ELECTION_BY_CARGO_GROUP.municipal;
  }
  if (STATE_CARGOS.has(cargo)) {
    return DEFAULT_ELECTION_BY_CARGO_GROUP.state;
  }
  return DEFAULT_ELECTION_BY_CARGO_GROUP.federal;
}

function resolveCargoElection(data: {
  cargo: TseCargo;
  ciclo?: string;
  codigo_eleicao?: string;
}): { ciclo: string; codigo_eleicao?: string } {
  const defaults = getCargoElectionDefaults(data.cargo);
  const ciclo = data.ciclo ?? defaults.ciclo;
  const codigo_eleicao =
    data.codigo_eleicao ?? (ciclo === defaults.ciclo ? defaults.codigoEleicao : undefined);
  return { ciclo, codigo_eleicao };
}

const cicloOptionalSchema = z
  .string()
  .trim()
  .regex(/^ele\d{4}$/, "Expected ciclo in format 'eleYYYY' (e.g., 'ele2026')")
  .optional();

const codigoEleicaoOptionalSchema = z
  .string()
  .trim()
  .regex(/^\d{1,6}$/, "Expected numeric codigo_eleicao (1 to 6 digits)")
  .optional();

const cicloSchema = cicloOptionalSchema.default("ele2026");

const codigoEleicaoSchema = codigoEleicaoOptionalSchema.default("6257");

const ufOptionalSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Expected 2-letter UF code or 'br'")
  .transform((s) => s.toLowerCase())
  .optional();

const codigoTseMunicipioSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Expected 5-digit TSE municipality code")
  .optional();

const VALID_UFS_SET = new Set([
  "ac", "al", "am", "ap", "ba", "ce", "df", "es", "go",
  "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr",
  "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to",
  "zz", "br",
]);

function isValidStateUf(uf?: string): boolean {
  return Boolean(uf && uf !== "br" && VALID_UFS_SET.has(uf));
}

function validateCargoScope(
  data: {
    cargo: TseCargo;
    ciclo?: string;
    codigo_eleicao?: string;
    uf?: string;
    codigo_tse_municipio?: string;
  },
  ctx: RefinementCtx,
): void {
  const { cargo, uf, codigo_tse_municipio } = data;
  const resolved = resolveCargoElection(data);

  if (!resolved.codigo_eleicao) {
    ctx.addIssue({
      code: "custom",
      path: ["codigo_eleicao"],
      message: `codigo_eleicao is required when ciclo is '${resolved.ciclo}' for cargo '${cargo}' (use tse_eleicoes_catalogo to look up election codes).`,
    });
  }

  if (uf && !VALID_UFS_SET.has(uf)) {
    ctx.addIssue({
      code: "custom",
      path: ["uf"],
      message: `Invalid UF code '${uf}'. Expected a valid Brazilian UF (e.g., 'sp', 'rj', 'df') or 'br'.`,
    });
    return;
  }

  if (MUNICIPAL_CARGOS.has(cargo)) {
    if (!isValidStateUf(uf)) {
      ctx.addIssue({
        code: "custom",
        path: ["uf"],
        message: `Cargo '${cargo}' requires a 2-letter state UF (different from 'br').`,
      });
    }
    if (!codigo_tse_municipio) {
      ctx.addIssue({
        code: "custom",
        path: ["codigo_tse_municipio"],
        message: `Cargo '${cargo}' requires a 5-digit codigo_tse_municipio.`,
      });
    }
    return;
  }

  if (STATE_CARGOS.has(cargo)) {
    if (!isValidStateUf(uf)) {
      ctx.addIssue({
        code: "custom",
        path: ["uf"],
        message: `Cargo '${cargo}' requires a 2-letter state UF (different from 'br').`,
      });
    }
    return;
  }

  if (codigo_tse_municipio && !isValidStateUf(uf)) {
    ctx.addIssue({
      code: "custom",
      path: ["uf"],
      message: "Providing codigo_tse_municipio requires a 2-letter state UF (different from 'br').",
    });
  }
}

function applyCargoElectionDefaults<
  T extends { cargo: TseCargo; ciclo?: string; codigo_eleicao?: string },
>(data: T): Omit<T, "ciclo" | "codigo_eleicao"> & { ciclo: string; codigo_eleicao: string } {
  const { ciclo, codigo_eleicao } = resolveCargoElection(data);
  const defaults = getCargoElectionDefaults(data.cargo);
  return {
    ...data,
    ciclo,
    codigo_eleicao: codigo_eleicao ?? defaults.codigoEleicao,
  };
}

export const TseEleicoesCatalogoSchema = z
  .object({
    ano: z.number().int().min(2014).max(2034).optional(),
    tipo: z.enum(["ordinaria", "suplementar", "todas"]).optional().default("todas"),
    uf: ufOptionalSchema,
    limit: z.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export const TseMunicipiosZonasSchema = z
  .object({
    ciclo: z
      .string()
      .trim()
      .regex(/^ele\d{4}$/, "Expected ciclo in format 'eleYYYY' (e.g., 'ele2024')")
      .optional()
      .default("ele2024"),
    codigo_eleicao: z
      .string()
      .trim()
      .regex(/^\d{1,6}$/, "Expected numeric codigo_eleicao (1 to 6 digits)")
      .optional()
      .default("619"),
    uf: ufOptionalSchema,
    codigo_ibge: z
      .string()
      .trim()
      .regex(/^\d{7}$/, "Expected 7-digit IBGE municipality code")
      .optional(),
    codigo_tse: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "Expected 5-digit TSE municipality code")
      .optional(),
    nome: z.string().trim().min(2, "nome must have at least 2 characters").max(120).optional(),
    limit: z.number().int().min(1).max(50).optional().default(25),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.uf && data.uf === "br") {
      ctx.addIssue({
        code: "custom",
        path: ["uf"],
        message: "Use a 2-letter state UF (different from 'br') for municipal lookups.",
      });
    }
    if (data.uf && !VALID_UFS_SET.has(data.uf)) {
      ctx.addIssue({
        code: "custom",
        path: ["uf"],
        message: `Invalid UF code '${data.uf}'.`,
      });
    }
    if (!data.uf && !data.codigo_ibge && !data.codigo_tse && !data.nome) {
      ctx.addIssue({
        code: "custom",
        message: "Provide at least one filter: uf, codigo_ibge, codigo_tse, or nome.",
      });
    }
  });

export const TseApuracaoCargoSchema = z
  .object({
    ciclo: cicloOptionalSchema,
    codigo_eleicao: codigoEleicaoOptionalSchema,
    cargo: z.enum(TSE_CARGOS),
    uf: ufOptionalSchema,
    codigo_tse_municipio: codigoTseMunicipioSchema,
    page: z.number().int().min(1).max(100).optional().default(1),
    limit: z.number().int().min(1).max(50).optional().default(25),
  })
  .strict()
  .superRefine(validateCargoScope)
  .transform(applyCargoElectionDefaults);

export const TseCandidatosBuscaSchema = z
  .object({
    ciclo: cicloOptionalSchema,
    codigo_eleicao: codigoEleicaoOptionalSchema,
    cargo: z.enum(TSE_CARGOS),
    uf: ufOptionalSchema,
    codigo_tse_municipio: codigoTseMunicipioSchema,
    nome: z.string().trim().min(2).max(120).optional(),
    numero: z
      .string()
      .trim()
      .regex(/^\d{2,5}$/, "Expected 2 to 5 digit candidate number")
      .optional(),
    partido: z.string().trim().min(1).max(30).optional(),
    apenas_eleitos: z.boolean().optional().default(false),
    limit: z.number().int().min(1).max(50).optional().default(20),
  })
  .strict()
  .superRefine(validateCargoScope)
  .transform(applyCargoElectionDefaults);

export const TsePartidosFederacoesSchema = z
  .object({
    ciclo: cicloOptionalSchema,
    codigo_eleicao: codigoEleicaoOptionalSchema,
    cargo: z.enum(TSE_CARGOS),
    uf: ufOptionalSchema,
    codigo_tse_municipio: codigoTseMunicipioSchema,
    partido: z.string().trim().min(1).max(30).optional(),
    limit: z.number().int().min(1).max(50).optional().default(25),
  })
  .strict()
  .superRefine(validateCargoScope)
  .transform(applyCargoElectionDefaults);

export const TseComparecimentoAbstencaoSchema = z
  .object({
    ciclo: cicloSchema,
    codigo_eleicao: codigoEleicaoSchema,
    uf: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, "Expected 2-letter UF code or 'br'")
      .transform((s) => s.toLowerCase())
      .optional()
      .default("br"),
    codigo_tse_municipio: codigoTseMunicipioSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!VALID_UFS_SET.has(data.uf)) {
      ctx.addIssue({
        code: "custom",
        path: ["uf"],
        message: `Invalid UF code '${data.uf}'. Expected a valid Brazilian UF or 'br'.`,
      });
    }
    if (data.codigo_tse_municipio && data.uf === "br") {
      ctx.addIssue({
        code: "custom",
        path: ["uf"],
        message: "Providing codigo_tse_municipio requires a 2-letter state UF (different from 'br').",
      });
    }
  });

export const TseDadosAbertosDatasetsSchema = z
  .object({
    query: z.string().trim().min(1).max(200).optional(),
    package_id: z
      .string()
      .trim()
      .regex(/^[a-z0-9_-]{3,120}$/, "Expected valid CKAN package_id slug (lowercase a-z, 0-9, -, _)")
      .optional(),
    ano: z.number().int().min(2014).max(2034).optional(),
    rows: z.number().int().min(1).max(25).optional().default(10),
  })
  .strict();

export type TseEleicoesCatalogoInput = z.infer<typeof TseEleicoesCatalogoSchema>;
export type TseMunicipiosZonasInput = z.infer<typeof TseMunicipiosZonasSchema>;
export type TseApuracaoCargoInput = z.infer<typeof TseApuracaoCargoSchema>;
export type TseCandidatosBuscaInput = z.infer<typeof TseCandidatosBuscaSchema>;
export type TsePartidosFederacoesInput = z.infer<typeof TsePartidosFederacoesSchema>;
export type TseComparecimentoAbstencaoInput = z.infer<typeof TseComparecimentoAbstencaoSchema>;
export type TseDadosAbertosDatasetsInput = z.infer<typeof TseDadosAbertosDatasetsSchema>;
