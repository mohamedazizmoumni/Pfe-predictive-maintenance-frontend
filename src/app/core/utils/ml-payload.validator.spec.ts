import { ML_FEATURE_COUNT, validateMlFeatures } from './ml-payload.validator';

describe('ml-payload.validator', () => {
  it('accepts rows with exactly 89 finite values', () => {
    const sample = Array.from({ length: ML_FEATURE_COUNT }, (_, index) => index + 0.5);

    const result = validateMlFeatures({ features: [sample] });

    expect(result.valid).toBeTrue();
    expect(result.normalizedFeatures.length).toBe(1);
    expect(result.normalizedFeatures[0].length).toBe(ML_FEATURE_COUNT);
  });

  it('rejects rows with less than 89 values', () => {
    const sample = Array.from({ length: ML_FEATURE_COUNT - 1 }, () => 1);

    const result = validateMlFeatures({ features: [sample] });

    expect(result.valid).toBeFalse();
    expect(result.message).toContain('exactly 89');
  });

  it('rejects non-finite values', () => {
    const sample = Array.from({ length: ML_FEATURE_COUNT }, () => 1);
    sample[4] = Number.NaN;

    const result = validateMlFeatures({ features: [sample] });

    expect(result.valid).toBeFalse();
    expect(result.message).toContain('finite number');
  });
});
