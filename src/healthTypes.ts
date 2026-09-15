export type Answer = string | number | boolean;

export type VoiceSample = {
  promptId: string;
  durationMs: number;
  rms: number;
  pauseRatio: number;
};

export type FeatureVector = {
  observationQuality: number;
  lighting: number;
  voiceConfidence: number;
  voiceRms: number;
  voicePauseRatio: number;
  inquiryBurden: number;
  sleepStress: number;
  tongueQuality: number;
};

export type BaselineStat = { n: number; mean: number; m2: number };
export type BaselineStats = Record<keyof FeatureVector, BaselineStat>;

export type SafetyAnswer = {
  id: 'severe-chest-pain' | 'severe-dyspnea' | 'syncope' | 'focal-neuro';
  value: boolean;
};

export type SafetyResult = {
  severity: 'info' | 'watch' | 'urgent';
  flags: string[];
  message: string;
};

export type FusionResult = {
  confidence: number;
  riskScore: number;
  trendScore: number;
  deviations: Record<string, number>;
  summary: string;
  signals: string[];
};

export type Recommendation = {
  level: 'routine' | 'monitor' | 'seek-care';
  items: string[];
  diagnosticDirection: string[];
};

export type HealthSession = {
  id: string;
  userId?: string;
  date: string;
  capturedAt: string;
  observation?: { quality: number; lighting: number };
  listening?: { confidence: number; samples: VoiceSample[] };
  inquiry?: { answers: { id: string; value: Answer }[] };
  tongue?: { quality: number; provider: string };
  safetyAnswers?: SafetyAnswer[];
  featureVector?: FeatureVector;
  fusion?: FusionResult;
  safety?: SafetyResult;
  recommendation?: Recommendation;
  syncState?: 'local' | 'synced' | 'pending';
};

export type BaselineRecord = {
  userId: string;
  sessionCount: number;
  featureStats: BaselineStats;
  lastSessionAt?: string;
};
