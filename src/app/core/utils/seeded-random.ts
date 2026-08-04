// Deterministic pseudo-random generator keyed by a string seed (e.g. a part
// number or machine serial). Used so derived/estimated figures stay stable
// between reloads instead of reshuffling like Math.random() would.
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function seededInt(seed: string, min: number, max: number): number {
  const rand = seededRandom(seed)();
  return Math.floor(min + rand * (max - min + 1));
}

export function seededFloat(seed: string, min: number, max: number, decimals = 1): number {
  const rand = seededRandom(seed)();
  const value = min + rand * (max - min);
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function seededPick<T>(seed: string, options: T[]): T {
  const idx = Math.floor(seededRandom(seed)() * options.length);
  return options[Math.min(idx, options.length - 1)];
}
