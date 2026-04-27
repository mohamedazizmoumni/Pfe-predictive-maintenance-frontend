import { MlFeaturesValidationResult } from '../models/predictive.models';

export const ML_FEATURE_COUNT = 89;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseFeaturesPayload(input: unknown): unknown {
  if (!input || typeof input !== 'object') {
    return input;
  }

  const payload = input as Record<string, unknown>;
  return payload['features'] ?? input;
}

export function validateMlFeatures(input: unknown): MlFeaturesValidationResult {
  const parsed = parseFeaturesPayload(input);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      valid: false,
      normalizedFeatures: [],
      message: 'features is required and must be a non-empty array.',
    };
  }

  const normalizedFeatures: number[][] = [];

  for (let rowIndex = 0; rowIndex < parsed.length; rowIndex += 1) {
    const row = parsed[rowIndex];

    if (!Array.isArray(row)) {
      return {
        valid: false,
        normalizedFeatures: [],
        message: `Row ${rowIndex + 1} must be an array.`,
      };
    }

    if (row.length !== ML_FEATURE_COUNT) {
      return {
        valid: false,
        normalizedFeatures: [],
        message: `Row ${rowIndex + 1} must contain exactly ${ML_FEATURE_COUNT} values.`,
      };
    }

    const normalizedRow: number[] = [];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const rawValue = row[colIndex];

      let numericValue: number;
      if (typeof rawValue === 'number') {
        numericValue = rawValue;
      } else if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
        numericValue = Number(rawValue);
      } else {
        return {
          valid: false,
          normalizedFeatures: [],
          message: `Row ${rowIndex + 1}, feature ${colIndex + 1} must be a finite number.`,
        };
      }

      if (!isFiniteNumber(numericValue)) {
        return {
          valid: false,
          normalizedFeatures: [],
          message: `Row ${rowIndex + 1}, feature ${colIndex + 1} must be a finite number.`,
        };
      }

      normalizedRow.push(numericValue);
    }

    normalizedFeatures.push(normalizedRow);
  }

  return {
    valid: true,
    normalizedFeatures,
    message: null,
  };
}

export function parseBatchFeaturesJson(input: string): MlFeaturesValidationResult {
  if (!input.trim()) {
    return {
      valid: false,
      normalizedFeatures: [],
      message: 'JSON payload is required.',
    };
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return validateMlFeatures(parsed);
  } catch {
    return {
      valid: false,
      normalizedFeatures: [],
      message: 'Invalid JSON. Please provide a valid JSON array or object with a features field.',
    };
  }
}
