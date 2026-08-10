/** Domain tags for IOAI / national olympiad tasks. */
export type IoaiDomain =
  | "cv"
  | "nlp"
  | "ml"
  | "tabular"
  | "ethics"
  | "python"
  | "multimodal"
  | "generative"
  | "audio"
  | "time_series";

export type IoaiResourceCategory =
  | "syllabus"
  | "task_repo"
  | "national_olympiad"
  | "course";

export type IoaiResourceSource = "curated" | "admin";

export const IOAI_DOMAINS: IoaiDomain[] = [
  "cv",
  "nlp",
  "ml",
  "tabular",
  "ethics",
  "python",
  "multimodal",
  "generative",
  "audio",
  "time_series",
];

export const IOAI_CATEGORIES: IoaiResourceCategory[] = [
  "syllabus",
  "task_repo",
  "national_olympiad",
  "course",
];

export type IoaiResource = {
  id: string;
  category: IoaiResourceCategory;
  title: string;
  url: string;
  region?: string;
  year?: number;
  domains: IoaiDomain[];
  topics: string[];
  summary: string;
  promptHint?: string;
};

export type IoaiResourceRecord = IoaiResource & {
  source: IoaiResourceSource;
  hidden: boolean;
  updatedAt?: string;
  /** Present when a localized Indonesian guide exists. */
  guideId?: string;
};

export type IoaiGuide = {
  id: string;
  resourceId: string;
  title: string;
  /** Indonesian markdown — task overview */
  ringkasan: string;
  /** Indonesian markdown — metrics, I/O, key checklist */
  kunciJawaban: string;
  /** Indonesian markdown — solution walkthrough */
  pembahasan: string;
  originalUrl: string;
  solutionUrl?: string;
  credit: string;
  topics: string[];
};

export type IoaiGuideRecord = IoaiGuide & {
  hidden: boolean;
  updatedAt?: string;
};
