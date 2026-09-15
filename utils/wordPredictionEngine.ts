import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Data structures ──────────────────────────────────────────────────────────

interface WordPredictionIndex {
  freq: Record<string, number>;
  bigram: Record<string, Record<string, number>>;
  trigram: Record<string, Record<string, number>>;
  prefix: Record<string, string[]>;
  builtAt: string;
  learnedCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@wordPrediction_index_v1';
const SETTINGS_KEY = '@wordPrediction_enabled';
const LEARNED_IDS_KEY = '@wordPrediction_learnedIds';
const MAX_PREFIX_LEN = 6;
const MIN_WORD_LEN = 2;
const MAX_FREQ_WORDS = 2000;

const WORKSHOP_ACRONYMS = new Set(['vhc', 'auc', 'pdi', 'abs', 'dpf', 'egr', 'ecu', 'mot', 'ac', 'ew']);

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cachedIndex: WordPredictionIndex | null = null;
let _cacheLoaded = false;

export function invalidateCache(): void {
  _cachedIndex = null;
  _cacheLoaded = false;
}

function emptyIndex(): WordPredictionIndex {
  return {
    freq: {},
    bigram: {},
    trigram: {},
    prefix: {},
    builtAt: new Date().toISOString(),
    learnedCount: 0,
  };
}

async function loadIndex(): Promise<WordPredictionIndex> {
  if (_cacheLoaded && _cachedIndex) return _cachedIndex;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WordPredictionIndex;
      _cachedIndex = parsed;
      _cacheLoaded = true;
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  const empty = emptyIndex();
  _cachedIndex = empty;
  _cacheLoaded = true;
  return empty;
}

async function saveIndex(index: WordPredictionIndex): Promise<void> {
  _cachedIndex = index;
  _cacheLoaded = true;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

// ─── Token cleaning ───────────────────────────────────────────────────────────

function cleanToken(raw: string): string | null {
  // Lowercase
  let token = raw.toLowerCase();

  // Strip leading/trailing punctuation (commas, periods, slashes, dashes)
  token = token.replace(/^[,./\-–—]+|[,./\-–—]+$/g, '');

  if (token.length === 0) return null;

  // Preserve workshop acronyms even if short
  if (WORKSHOP_ACRONYMS.has(token)) return token;

  // Too short
  if (token.length < MIN_WORD_LEN) return null;

  // Purely numeric
  if (/^\d+$/.test(token)) return null;

  // Looks like a vehicle registration: AB12CDE or A123BCD
  if (/^[a-z]{2}\d{2}[a-z]{3}$/i.test(token)) return null;
  if (/^[a-z]\d{1,3}[a-z]{3}$/i.test(token)) return null;

  // Contains only punctuation/symbols (no letters or digits)
  if (!/[a-z0-9]/.test(token)) return null;

  return token;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

function tokenizeDescription(desc: string): string[] {
  const parts = desc.split(/[\s,]+/);
  const result: string[] = [];
  for (const part of parts) {
    const cleaned = cleanToken(part);
    if (cleaned) result.push(cleaned);
  }
  return result;
}

// ─── Preferred case ───────────────────────────────────────────────────────────

function getPreferredCase(word: string, freq: Record<string, number>): string {
  const lower = word.toLowerCase();
  if (WORKSHOP_ACRONYMS.has(lower)) {
    const upper = lower.toUpperCase();
    const upperFreq = freq[upper] ?? 0;
    const lowerFreq = freq[lower] ?? 0;
    if (upperFreq >= lowerFreq && upperFreq > 0) return upper;
  }
  const upper = word.toUpperCase();
  const upperFreq = freq[upper] ?? 0;
  const lowerFreq = freq[lower] ?? 0;
  if (upperFreq > 0 && upperFreq >= lowerFreq) return upper;
  return lower;
}

// ─── Prefix index helpers ─────────────────────────────────────────────────────

function buildPrefixForWord(word: string, freq: Record<string, number>, prefix: Record<string, string[]>): void {
  const lower = word.toLowerCase();
  const maxLen = Math.min(lower.length, MAX_PREFIX_LEN);
  for (let len = 2; len <= maxLen; len++) {
    const pfx = lower.slice(0, len);
    if (!prefix[pfx]) prefix[pfx] = [];
    if (!prefix[pfx].includes(lower)) {
      prefix[pfx].push(lower);
    }
    // Keep top 5 by freq
    prefix[pfx].sort((a, b) => (freq[b] ?? 0) - (freq[a] ?? 0));
    if (prefix[pfx].length > 5) prefix[pfx] = prefix[pfx].slice(0, 5);
  }
}

function rebuildAllPrefixes(freq: Record<string, number>): Record<string, string[]> {
  const prefix: Record<string, string[]> = {};
  for (const word of Object.keys(freq)) {
    buildPrefixForWord(word, freq, prefix);
  }
  return prefix;
}

// ─── Pruning ──────────────────────────────────────────────────────────────────

function pruneFreq(freq: Record<string, number>): Record<string, number> {
  const entries = Object.entries(freq);
  if (entries.length <= MAX_FREQ_WORDS) return freq;
  entries.sort((a, b) => b[1] - a[1]);
  const pruned: Record<string, number> = {};
  for (const [word, count] of entries.slice(0, MAX_FREQ_WORDS)) {
    pruned[word] = count;
  }
  return pruned;
}

// ─── Build index from all descriptions ───────────────────────────────────────

export async function buildPredictionIndex(allDescriptions: string[]): Promise<void> {
  console.log('[WordPrediction] buildPredictionIndex called with', allDescriptions.length, 'descriptions');
  const freq: Record<string, number> = {};
  const bigram: Record<string, Record<string, number>> = {};
  const trigram: Record<string, Record<string, number>> = {};

  for (const desc of allDescriptions) {
    const tokens = tokenizeDescription(desc);
    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      freq[w] = (freq[w] ?? 0) + 1;

      if (i > 0) {
        const prev = tokens[i - 1];
        if (!bigram[prev]) bigram[prev] = {};
        bigram[prev][w] = (bigram[prev][w] ?? 0) + 1;
      }

      if (i > 1) {
        const key = `${tokens[i - 2]}|${tokens[i - 1]}`;
        if (!trigram[key]) trigram[key] = {};
        trigram[key][w] = (trigram[key][w] ?? 0) + 1;
      }
    }
  }

  const prunedFreq = pruneFreq(freq);
  const prefix = rebuildAllPrefixes(prunedFreq);

  const index: WordPredictionIndex = {
    freq: prunedFreq,
    bigram,
    trigram,
    prefix,
    builtAt: new Date().toISOString(),
    learnedCount: allDescriptions.length,
  };

  await saveIndex(index);
  console.log('[WordPrediction] Index built — words:', Object.keys(prunedFreq).length, 'learnedCount:', allDescriptions.length);
}

// ─── Learn one description ────────────────────────────────────────────────────

export async function learnDescription(jobId: string, description: string): Promise<void> {
  console.log('[WordPrediction] learnDescription called for jobId:', jobId);
  try {
    // Check if already learned
    const learnedRaw = await AsyncStorage.getItem(LEARNED_IDS_KEY);
    const learnedIds: string[] = learnedRaw ? JSON.parse(learnedRaw) : [];
    if (learnedIds.includes(jobId)) {
      console.log('[WordPrediction] jobId already learned, skipping:', jobId);
      return;
    }

    const index = await loadIndex();
    const tokens = tokenizeDescription(description);

    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      index.freq[w] = (index.freq[w] ?? 0) + 1;

      if (i > 0) {
        const prev = tokens[i - 1];
        if (!index.bigram[prev]) index.bigram[prev] = {};
        index.bigram[prev][w] = (index.bigram[prev][w] ?? 0) + 1;
      }

      if (i > 1) {
        const key = `${tokens[i - 2]}|${tokens[i - 1]}`;
        if (!index.trigram[key]) index.trigram[key] = {};
        index.trigram[key][w] = (index.trigram[key][w] ?? 0) + 1;
      }

      // Rebuild prefix entries only for new/updated words
      buildPrefixForWord(w, index.freq, index.prefix);
    }

    index.freq = pruneFreq(index.freq);
    index.learnedCount = (index.learnedCount ?? 0) + 1;
    index.builtAt = new Date().toISOString();

    await saveIndex(index);

    // Mark as learned
    learnedIds.push(jobId);
    await AsyncStorage.setItem(LEARNED_IDS_KEY, JSON.stringify(learnedIds));
    console.log('[WordPrediction] Learned description for jobId:', jobId, 'tokens:', tokens.length);
  } catch (err) {
    console.warn('[WordPrediction] learnDescription error:', err);
  }
}

// ─── Get predictions ──────────────────────────────────────────────────────────

export async function getPredictions(
  textBeforeCursor: string,
  partialWord: string,
  count: number = 3
): Promise<string[]> {
  try {
    const index = await loadIndex();
    const { freq, bigram, trigram, prefix } = index;

    if (Object.keys(freq).length === 0) return [];

    // Extract context words (last two complete words before cursor)
    const contextText = partialWord
      ? textBeforeCursor.slice(0, textBeforeCursor.length - partialWord.length)
      : textBeforeCursor;

    const contextTokens = tokenizeDescription(contextText);
    const prevWord = contextTokens.length >= 1 ? contextTokens[contextTokens.length - 1] : '';
    const prevPrevWord = contextTokens.length >= 2 ? contextTokens[contextTokens.length - 2] : '';

    let candidates: string[] = [];

    if (partialWord.length > 0) {
      const pfxKey = partialWord.toLowerCase().slice(0, MAX_PREFIX_LEN);
      const prefixCandidates = prefix[pfxKey] ?? [];
      // Also scan freq for any word starting with partial (fallback for short prefix lists)
      const allCandidates = new Set<string>(prefixCandidates);
      const lowerPartial = partialWord.toLowerCase();
      for (const word of Object.keys(freq)) {
        if (word.startsWith(lowerPartial)) allCandidates.add(word);
      }

      // Score each candidate
      const scored: Array<{ word: string; score: number }> = [];
      for (const word of allCandidates) {
        if (!word.startsWith(lowerPartial)) continue;
        if (word === lowerPartial) continue; // already typed exactly

        let score = freq[word] ?? 0;
        if (prevWord && bigram[prevWord]?.[word]) {
          score += bigram[prevWord][word] * 3;
        }
        if (prevPrevWord && prevWord) {
          const tKey = `${prevPrevWord}|${prevWord}`;
          if (trigram[tKey]?.[word]) {
            score += trigram[tKey][word] * 5;
          }
        }
        scored.push({ word, score });
      }

      scored.sort((a, b) => b.score - a.score);
      candidates = scored.slice(0, count).map(s => s.word);
    } else {
      // No partial word — use context to predict next word
      const scored: Record<string, number> = {};
      const addScore = (word: string, bonus: number) => {
        if (!scored[word]) scored[word] = 0;
        scored[word] += bonus;
      };

      if (prevPrevWord && prevWord) {
        const tKey = `${prevPrevWord}|${prevWord}`;
        const tCandidates = trigram[tKey] ?? {};
        for (const [w, c] of Object.entries(tCandidates)) {
          addScore(w, c * 5);
        }
      }

      if (prevWord && bigram[prevWord]) {
        for (const [w, c] of Object.entries(bigram[prevWord])) {
          addScore(w, c * 3);
        }
      }

      // Fallback: top freq words
      if (Object.keys(scored).length < count) {
        const topFreq = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, count * 3);
        for (const [w, c] of topFreq) {
          addScore(w, c);
        }
      }

      const entries = Object.entries(scored);
      entries.sort((a, b) => b[1] - a[1]);
      candidates = entries.slice(0, count).map(([w]) => w);
    }

    // Apply preferred case
    return candidates.map(w => getPreferredCase(w, freq));
  } catch (err) {
    console.warn('[WordPrediction] getPredictions error:', err);
    return [];
  }
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

export async function isPredictionEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(SETTINGS_KEY);
    if (val === null) return true; // default enabled
    return val === 'true';
  } catch {
    return true;
  }
}

export async function setPredictionEnabled(enabled: boolean): Promise<void> {
  console.log('[WordPrediction] setPredictionEnabled:', enabled);
  await AsyncStorage.setItem(SETTINGS_KEY, enabled ? 'true' : 'false');
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const wordPredictionEngine = {
  buildPredictionIndex,
  learnDescription,
  getPredictions,
  isPredictionEnabled,
  setPredictionEnabled,
  invalidateCache,
};
