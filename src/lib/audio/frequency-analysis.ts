/**
 * Conservative, dependency-free estimator for a single dominant acoustic tone.
 * No hardware calibration, source identification, SPL or therapeutic inference.
 * tonalFraction is windowed spectral energy in +/- 2 FFT bins around the peak;
 * it is not a calibrated purity score or a probability.
 */
export type FrequencyStatus = 'silence' | 'clipped' | 'uncertain' | 'off_target' | 'near_target';

export interface FrequencyAnalysis {
  status: FrequencyStatus;
  dominantHz: number | null;
  tonalFraction: number | null;
  rmsDbfs: number | null;
  observationSeconds: number;
  binSpacingHz: number;
  reason: string;
}

const MIN_SIZE = 1024;
const MAX_SIZE = 131072;
const MIN_RATE = 8000;
const MAX_RATE = 192000;
const MAX_BIN_SPACING = 2;
const MIN_OBSERVATION_SECONDS = 0.5;
const SILENCE_RMS = 0.0001; // -80 dBFS, a numerical threshold, not sound pressure.
const MIN_TONAL_FRACTION = 0.985;
const MAX_SECONDARY_PEAK_FRACTION = 0.001;

function fft(real: Float64Array, imaginary: Float64Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const previous = real[i];
      real[i] = real[j];
      real[j] = previous;
    }
  }
  for (let length = 2; length <= n; length *= 2) {
    const angle = -2 * Math.PI / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let offset = 0; offset < n; offset += length) {
      let wReal = 1;
      let wImaginary = 0;
      for (let j = 0; j < length / 2; j++) {
        const first = offset + j;
        const second = first + length / 2;
        const productReal = real[second] * wReal - imaginary[second] * wImaginary;
        const productImaginary = real[second] * wImaginary + imaginary[second] * wReal;
        real[second] = real[first] - productReal;
        imaginary[second] = imaginary[first] - productImaginary;
        real[first] += productReal;
        imaginary[first] += productImaginary;
        const nextReal = wReal * stepReal - wImaginary * stepImaginary;
        wImaginary = wReal * stepImaginary + wImaginary * stepReal;
        wReal = nextReal;
      }
    }
  }
}

export function analyzeFrequency(
  samples: Float32Array,
  sampleRate: number,
  targetHz = 432,
): FrequencyAnalysis {
  const validRate = Number.isFinite(sampleRate) && sampleRate >= MIN_RATE && sampleRate <= MAX_RATE;
  const validArray = samples instanceof Float32Array;
  const n = validArray ? samples.length : 0;
  const result: FrequencyAnalysis = {
    status: 'uncertain', dominantHz: null, tonalFraction: null, rmsDbfs: null,
    observationSeconds: validRate ? n / sampleRate : 0,
    binSpacingHz: validRate && n > 0 ? sampleRate / n : 0,
    reason: '',
  };
  if (!validRate || !validArray || n < MIN_SIZE || n > MAX_SIZE || (n & (n - 1)) !== 0) {
    result.reason = 'Cadre invalide : Float32Array de 1024 à 131072 points, taille puissance de deux et échantillonnage de 8 à 192 kHz requis.';
    return result;
  }
  const upperHz = Math.min(6000, sampleRate * 0.475);
  if (!Number.isFinite(targetHz) || targetHz < 40 || targetHz > upperHz) {
    result.reason = 'Cible invalide ou hors de la bande analysable (40 Hz à 6000 Hz au maximum, selon Nyquist).';
    return result;
  }
  if (result.binSpacingHz > MAX_BIN_SPACING || result.observationSeconds < MIN_OBSERVATION_SECONDS) {
    result.reason = 'Observation trop courte ou résolution insuffisante : au moins 0,5 seconde et un espacement FFT inférieur ou égal à 2 Hz requis.';
    return result;
  }
  let sum = 0;
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const value = samples[i];
    if (!Number.isFinite(value)) {
      result.reason = 'Échantillon non fini : analyse refusée.';
      return result;
    }
    sum += value;
    sumSquares += value * value;
    peak = Math.max(peak, Math.abs(value));
  }
  const mean = sum / n;
  const rms = Math.sqrt(sumSquares / n);
  result.rmsDbfs = rms > 0 ? 20 * Math.log10(rms) : null;
  if (peak >= 0.999) {
    result.status = 'clipped';
    result.reason = 'Crêtes à la pleine échelle numérique ou au-delà : écrêtage possible, estimation de tonalité écartée.';
    return result;
  }
  if (rms < SILENCE_RMS) {
    result.status = 'silence';
    result.reason = 'Signal nul ou inférieur au seuil numérique de -80 dBFS ; ce seuil ne mesure pas le silence acoustique.';
    return result;
  }
  const acRms = Math.sqrt(Math.max(0, sumSquares / n - mean * mean));
  if (acRms < SILENCE_RMS || Math.abs(mean) > Math.max(0.05, acRms * 0.5)) {
    result.reason = 'Signal constant ou composante continue importante : aucune tonalité fiable.';
    return result;
  }

  const real = new Float64Array(n);
  const imaginary = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const hann = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
    real[i] = (samples[i] - mean) * hann;
  }
  fft(real, imaginary);
  const powers = new Float64Array(n / 2 + 1);
  let totalPower = 0;
  for (let k = 1; k <= n / 2; k++) {
    powers[k] = real[k] * real[k] + imaginary[k] * imaginary[k];
    // The Nyquist bin has no negative-frequency counterpart.
    totalPower += powers[k] * (k === n / 2 ? 0.5 : 1);
  }
  const firstBin = Math.max(2, Math.ceil(40 / result.binSpacingHz));
  const lastBin = Math.min(n / 2 - 2, Math.floor(upperHz / result.binSpacingHz));
  let peakBin = firstBin;
  for (let k = firstBin + 1; k <= lastBin; k++) {
    if (powers[k] > powers[peakBin]) peakBin = k;
  }
  if (totalPower <= 0 || powers[peakBin] / totalPower < 0.01) {
    result.reason = 'Aucune composante dominante exploitable dans la bande analysée.';
    return result;
  }

  const left = Math.log(Math.max(powers[peakBin - 1], Number.MIN_VALUE));
  const center = Math.log(Math.max(powers[peakBin], Number.MIN_VALUE));
  const right = Math.log(Math.max(powers[peakBin + 1], Number.MIN_VALUE));
  const denominator = left - 2 * center + right;
  const correction = denominator === 0 ? 0 : Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / denominator));
  const estimatedHz = (peakBin + correction) * result.binSpacingHz;
  result.dominantHz = Math.round(estimatedHz * 10) / 10;

  let peakPower = 0;
  for (let k = peakBin - 2; k <= peakBin + 2; k++) peakPower += powers[k];
  result.tonalFraction = Math.min(1, Math.max(0, peakPower / totalPower));
  let secondaryPower = 0;
  for (let k = 2; k < n / 2 - 1; k++) {
    if (Math.abs(k - peakBin) <= 4) continue;
    if (powers[k] >= powers[k - 1] && powers[k] >= powers[k + 1]) {
      secondaryPower = Math.max(secondaryPower, powers[k - 1] + powers[k] + powers[k + 1]);
    }
  }
  if (result.tonalFraction < MIN_TONAL_FRACTION || secondaryPower / totalPower >= MAX_SECONDARY_PEAK_FRACTION) {
    result.reason = 'Composantes multiples, harmoniques ou bruit : pic dominant estimé, sans conclure à une sinusoïde unique ni à sa fondamentale.';
    return result;
  }
  if (estimatedHz < 40 || estimatedHz > upperHz || peakBin === firstBin || peakBin === lastBin) {
    result.reason = 'Pic près de la limite de bande : estimation non concluante.';
    return result;
  }
  if (Math.abs(estimatedHz - targetHz) <= 2) {
    result.status = 'near_target';
    result.reason = 'Dominante quasi sinusoïdale estimée à moins de 2 Hz de la cible ; ni étalonnage, ni identification de source, ni preuve de pureté physique.';
  } else {
    result.status = 'off_target';
    result.reason = 'Dominante quasi sinusoïdale estimée à plus de 2 Hz de la cible ; mesure non étalonnée.';
  }
  return result;
}
