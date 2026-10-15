/** Monophonic normalized autocorrelation. No browser dependencies. */
export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function frequencyToNote(frequency: number, reference = 440) {
  const midi = 69 + 12 * Math.log2(frequency / reference);
  const nearest = Math.round(midi);
  return { noteName: NOTE_NAMES[((nearest % 12) + 12) % 12], octave: Math.floor(nearest / 12) - 1, cents: (midi - nearest) * 100 };
}
export function analyzePitch(buffer: Float32Array, sampleRate: number, correlations = new Float32Array(2048)) {
  let mean = 0;
  for (const value of buffer) mean += value;
  mean /= buffer.length;
  let energy = 0;
  for (const value of buffer) energy += (value - mean) ** 2;
  const rms = Math.sqrt(energy / buffer.length);
  if (rms < 0.00005) return { frequency: -1, confidence: 0, rms };
  const minLag = Math.max(2, Math.floor(sampleRate / 1100));
  const maxLag = Math.min(Math.ceil(sampleRate / 65), Math.floor(buffer.length / 2), correlations.length - 2);
  let max = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let dot = 0, a2 = 0, b2 = 0;
    const count = buffer.length - maxLag;
    for (let i = 0; i < count; i++) {
      const a = buffer[i] - mean, b = buffer[i + lag] - mean;
      dot += a * b; a2 += a * a; b2 += b * b;
    }
    const value = dot / Math.max(1e-15, Math.sqrt(a2 * b2));
    correlations[lag] = value;
    max = Math.max(max, value);
  }
  // First strong local maximum avoids selecting a multiple of the fundamental period.
  const threshold = Math.max(0.78, max * 0.92);
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    const middle = correlations[lag];
    if (middle < threshold || middle <= correlations[lag - 1] || middle < correlations[lag + 1]) continue;
    const denominator = 2 * (2 * middle - correlations[lag - 1] - correlations[lag + 1]);
    const offset = Math.abs(denominator) > 1e-12 ? (correlations[lag + 1] - correlations[lag - 1]) / denominator : 0;
    return { frequency: sampleRate / (lag + Math.max(-0.5, Math.min(0.5, offset))), confidence: middle, rms };
  }
  return { frequency: -1, confidence: max, rms };
}
