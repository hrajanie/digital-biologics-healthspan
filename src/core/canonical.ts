import { hash } from './random';

/** Each projected noninteger moves by at most 5e-12 relative (12 significant digits). */
export const SEMANTIC_SIGNIFICANT_DIGITS = 12;
export const SEMANTIC_RELATIVE_ROUNDING_BOUND = 5e-12;

/**
 * A checksum-only projection, never an update to authoritative state.
 * Integer ledgers and exact rational strings remain exact. Object keys are sorted;
 * array order is meaningful. Noninteger measurements use deterministic decimal
 * quantization to absorb insignificant browser/runtime transcendental differences.
 * This is quantization, not a general pairwise tolerance: values on opposite sides
 * of a rounding boundary can still differ. Nonfinite values are invalid save data.
 */
export function canonicalValue(value: unknown): unknown {
  const ancestors = new Set<object>();
  const project = (item: unknown): unknown => {
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new RangeError('Semantic checksums require finite numeric values.');
      return Number.isInteger(item) ? item : Number(item.toPrecision(SEMANTIC_SIGNIFICANT_DIGITS));
    }
    if (item === null || item === undefined || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item !== 'object') throw new TypeError('Semantic checksums require serializable state values.');
    if (ancestors.has(item)) throw new TypeError('Semantic checksums cannot contain circular state.');
    ancestors.add(item);
    const result = Array.isArray(item)
      ? item.map(project)
      : Object.fromEntries(Object.keys(item).sort().map(key => [key, project((item as Record<string, unknown>)[key])]));
    ancestors.delete(item);
    return result;
  };
  return project(value);
}

/** Callers retain ownership of structural choices such as excluding trace hashes. */
export function semanticChecksum(value: unknown): string { return hash(canonicalValue(value)); }
