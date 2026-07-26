export type CampaignStageId = "belajar" | "latihan" | "simulasi";

export type CampaignStages = {
  belajar: { unlocked: true; completed: number; total: number };
  latihan: { unlocked: boolean; correct: number; attempts: number };
  simulasi: { unlocked: boolean; completedMocks: number };
  current: CampaignStageId;
};

export type CampaignPayload = {
  levelsCompleted: number;
  totalLevels: number;
  sideQuestAttempts: number;
  sideQuestCorrect: number;
  stages: CampaignStages;
};

/** Soft visual progression: Belajar → Latihan → Simulasi. */
export function buildCampaignStages(input: {
  levelsCompleted: number;
  totalLevels: number;
  sideQuestAttempts: number;
  sideQuestCorrect: number;
  completedMocks: number;
}): CampaignStages {
  const belajar = {
    unlocked: true as const,
    completed: input.levelsCompleted,
    total: input.totalLevels,
  };
  const latihanUnlocked =
    input.levelsCompleted >= 1 || input.sideQuestAttempts > 0;
  const latihan = {
    unlocked: latihanUnlocked,
    correct: input.sideQuestCorrect,
    attempts: input.sideQuestAttempts,
  };
  const simulasiUnlocked =
    input.sideQuestAttempts >= 1 || input.completedMocks > 0;
  const simulasi = {
    unlocked: simulasiUnlocked,
    completedMocks: input.completedMocks,
  };

  let current: CampaignStageId = "belajar";
  if (simulasiUnlocked) current = "simulasi";
  else if (latihanUnlocked) current = "latihan";

  return { belajar, latihan, simulasi, current };
}

export function buildCampaignPayload(input: {
  levelsCompleted: number;
  totalLevels: number;
  sideQuestAttempts: number;
  sideQuestCorrect: number;
  completedMocks: number;
}): CampaignPayload {
  return {
    levelsCompleted: input.levelsCompleted,
    totalLevels: input.totalLevels,
    sideQuestAttempts: input.sideQuestAttempts,
    sideQuestCorrect: input.sideQuestCorrect,
    stages: buildCampaignStages(input),
  };
}
