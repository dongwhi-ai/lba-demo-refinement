export const FILE_KEYS = ["drama", "cooking", "assembly"] as const;
export type FileKey = (typeof FILE_KEYS)[number];

export const FILE_LABELS: Record<FileKey, string> = {
  drama: "드라마",
  cooking: "요리",
  assembly: "조립",
};

export const ROWS_PER_FILE = 500;

// public/data/*.json row 배열의 열 인덱스 (scripts/build_data.py EXPECTED_COLUMNS와 동일 순서)
export const COL = {
  VIDEO_IDX: 0,
  QA_IDX: 1,
  VIDEO_TYPE: 2,
  VIDEO_TITLE: 3,
  VIDEO_URL: 4,
  QUESTION_TYPE: 5,
  QUESTION: 6,
  CHOICE_1: 7,
  ANSWER: 12,
  REFINEMENT: 13,
  RATIONALE: 14,
  NOTE: 15,
} as const;

export const CHOICE_COUNT = 5;

export type CellValue = string | number;
export type Sc04Row = CellValue[];

export interface Sc04File {
  meta: { schemaVersion: number; builtAt: string; columns: string[] };
  key: FileKey;
  label: string;
  sourceFile: string;
  rows: Sc04Row[];
}

export type Status = "accept" | "fix" | "del";
export type RowStatus = Status | "none";

export const STATUS_LABELS: Record<RowStatus, string> = {
  none: "미검수",
  accept: "채택",
  fix: "수정",
  del: "폐기",
};

export type FixCategory = "Aa" | "Ab" | "Ac" | "Ba" | "Bb" | "C";

export const FIX_CATEGORIES: { value: FixCategory; label: string }[] = [
  { value: "Aa", label: "질문 형식 문제" },
  { value: "Ab", label: "질문 품질 문제" },
  { value: "Ac", label: "영상 근거 문제" },
  { value: "Ba", label: "선택지 형식 문제" },
  { value: "Bb", label: "선택지 품질 문제" },
  { value: "C", label: "기타 annotation 관련" },
];

const CATEGORY_ORDER: Record<FixCategory, number> = {
  Aa: 0,
  Ab: 1,
  Ac: 2,
  Ba: 3,
  Bb: 4,
  C: 5,
};

export interface Annotation {
  s: Status;
  c?: FixCategory[];
  m?: string;
}

export type Filter = "all" | RowStatus;

export const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "none", label: "미검수" },
  { value: "accept", label: "채택" },
  { value: "fix", label: "수정" },
  { value: "del", label: "폐기" },
];

// scripts/build_data.py YOUTUBE_PATTERNS와 동일한 패턴 유지
const YOUTUBE_PATTERNS = [
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
];

export function parseYoutubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = pattern.exec(url);
    if (match) return match[1];
  }
  return null;
}

export function rowStatus(ann: Annotation | undefined): RowStatus {
  return ann ? ann.s : "none";
}

export function matchesFilter(
  ann: Annotation | undefined,
  filter: Filter,
): boolean {
  return filter === "all" || rowStatus(ann) === filter;
}

// 검수 가이드 규격: 채택 → 빈칸, 수정 → "fix, <카테고리...>, <메모>", 폐기 → "del"
export function buildRefinement(ann: Annotation | undefined): string {
  if (!ann || ann.s === "accept") return "";
  if (ann.s === "del") return "del";
  const cats = [...(ann.c ?? [])].sort(
    (a, b) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b],
  );
  const memo = ann.m?.trim();
  return ["fix", ...cats, ...(memo ? [memo] : [])].join(", ");
}

export function findNextIndex(
  count: number,
  fromIdx: number,
  predicate: (idx: number) => boolean,
  options: { wrap: boolean; direction?: 1 | -1 },
): number | null {
  const direction = options.direction ?? 1;
  const limit = options.wrap
    ? count - 1
    : direction === 1
      ? count - 1 - fromIdx
      : fromIdx;
  for (let step = 1; step <= limit; step++) {
    const idx = (((fromIdx + direction * step) % count) + count) % count;
    if (predicate(idx)) return idx;
  }
  return null;
}
