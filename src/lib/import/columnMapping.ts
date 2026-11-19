import type { FieldDefinition, ColumnMapping, ColumnMappingValidationResult } from "./types";
import { fieldsForImportType, requiredFieldKeys } from "./fields";
import type { ImportDataType } from "./types";

function normalizeHeaderLabel(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ");
}

function scoreMatch(header: string, field: FieldDefinition): number {
  const h = normalizeHeaderLabel(header);
  if (!h) return 0;

  const label = normalizeHeaderLabel(field.label);
  if (h === label) return 100;
  if (h === normalizeHeaderLabel(field.key)) return 95;

  for (const syn of field.synonyms) {
    const s = normalizeHeaderLabel(syn);
    if (h === s) return 90;
    if (h.includes(s) || s.includes(h)) return 70;
  }

  return 0;
}

export function suggestColumnMapping(
  headers: string[],
  importType: ImportDataType
): ColumnMapping {
  const fields = fieldsForImportType(importType);
  const mapping: ColumnMapping = {};
  const usedTargets = new Set<string>();

  for (const header of headers) {
    const scores = fields
      .map((f) => ({ field: f, score: scoreMatch(header, f) }))
      .filter((x) => x.score >= 70)
      .sort((a, b) => b.score - a.score);

    const best = scores.find((s) => !usedTargets.has(s.field.key));
    if (best) {
      mapping[header] = best.field.key;
      usedTargets.add(best.field.key);
    } else {
      mapping[header] = null;
    }
  }

  return mapping;
}

export function validateColumnMapping(
  headers: string[],
  mapping: ColumnMapping,
  importType: ImportDataType
): ColumnMappingValidationResult {
  const errors: string[] = [];
  const required = requiredFieldKeys(importType);
  const targetToSources = new Map<string, string[]>();

  for (const header of headers) {
    const target = mapping[header];
    if (!target) continue;
    const list = targetToSources.get(target) ?? [];
    list.push(header);
    targetToSources.set(target, list);
  }

  for (const [target, sources] of Array.from(targetToSources.entries())) {
    if (sources.length > 1) {
      errors.push(
        `Kolom sistem "${target}" dipetakan ke lebih dari satu kolom sumber: ${sources.join(", ")}.`
      );
    }
  }

  for (const key of required) {
    const mapped = Array.from(targetToSources.entries()).find(([k]) => k === key);
    if (!mapped) {
      const field = fieldsForImportType(importType).find((f) => f.key === key);
      errors.push(
        `Kolom wajib "${field?.label ?? key}" belum dipetakan.`
      );
    }
  }

  for (const header of Object.keys(mapping)) {
    if (!headers.includes(header)) {
      errors.push(`Pemetaan memuat kolom yang tidak ada di file: "${header}".`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    mapping,
  };
}

export function applyMappingToRow(
  row: Record<string, string>,
  mapping: ColumnMapping
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [sourceHeader, value] of Object.entries(row)) {
    const target = mapping[sourceHeader];
    if (target) {
      out[target] = value;
    }
  }
  return out;
}