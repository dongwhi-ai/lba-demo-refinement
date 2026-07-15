export const FILE_KEYS = ["drama", "cooking", "assembly"] as const;
export type FileKey = (typeof FILE_KEYS)[number];

export const FILE_LABELS: Record<FileKey, string> = {
  drama: "드라마",
  cooking: "요리",
  assembly: "조립",
};

export const ROWS_PER_FILE = 825;

// public/data/*.json row 배열의 열 인덱스 (scripts/build_data.py EXPECTED_COLUMNS와 동일 순서)
// v1.5(2차 정제): 정답 뒤에 1차 검수상태 열이 삽입되어 refinement 이후가 한 칸씩 밀림
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
  PREV_STATUS: 13,
  REFINEMENT: 14,
  RATIONALE: 15,
  NOTE: 16,
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
  // 1차 판정에서 자동 seed된 항목. 검수자가 확정(재판정)하면 플래그 없이 저장된다.
  seed?: boolean;
}

export type Filter = "all" | RowStatus;

export const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "none", label: "미검수" },
  { value: "accept", label: "채택" },
  { value: "fix", label: "수정" },
  { value: "del", label: "폐기" },
];

// ---- 1차 정제 결과 (v1.5 xlsx의 검수상태/refinement 열) ----

// 모든 행에 1차 상태가 존재하므로 "none"은 불필요
export type PrevFilter = "all" | Status;

export const PREV_FILTER_OPTIONS: { value: PrevFilter; label: string }[] = [
  { value: "all", label: "1차 전체" },
  { value: "accept", label: "1차 채택" },
  { value: "fix", label: "1차 수정" },
  { value: "del", label: "1차 폐기" },
];

const PREV_STATUS_MAP: Record<string, Status> = {
  채택: "accept",
  수정: "fix",
  폐기: "del",
};

export function parsePrevStatus(cell: CellValue | undefined): Status | null {
  return PREV_STATUS_MAP[String(cell ?? "")] ?? null;
}

export function matchesPrevFilter(
  prev: Status | null,
  filter: PrevFilter,
): boolean {
  return filter === "all" || prev === filter;
}

const FIX_CATEGORY_SET = new Set<string>(Object.keys(CATEGORY_ORDER));

// buildRefinement의 역함수: "fix, <카테고리...>, <메모>" 파싱.
// 메모에 ", "가 포함될 수 있으므로 선두의 유효 카테고리 토큰만 소비하고 나머지는 재결합한다.
export function parseRefinement(refinement: string): {
  cats: FixCategory[];
  memo: string;
} {
  const tokens = refinement.split(", ");
  if (tokens[0] !== "fix") return { cats: [], memo: refinement };
  let i = 1;
  const cats: FixCategory[] = [];
  while (i < tokens.length && FIX_CATEGORY_SET.has(tokens[i])) {
    cats.push(tokens[i] as FixCategory);
    i += 1;
  }
  return { cats, memo: tokens.slice(i).join(", ") };
}

// 한 행의 1차 판정(검수상태/refinement 열)을 2차 seed annotation으로 변환
export function buildSeedAnnotation(row: Sc04Row): Annotation | null {
  const prev = parsePrevStatus(row[COL.PREV_STATUS]);
  if (!prev) return null;
  const entry: Annotation = { s: prev, seed: true };
  if (prev === "fix") {
    const { cats, memo } = parseRefinement(String(row[COL.REFINEMENT] ?? ""));
    if (cats.length > 0) entry.c = cats;
    if (memo !== "") entry.m = memo;
  }
  return entry;
}

// 1차 판정을 2차의 초기 seed annotation 맵으로 변환
export function buildSeedAnnotations(
  rows: Sc04Row[],
): Record<string, Annotation> {
  const ann: Record<string, Annotation> = {};
  for (const row of rows) {
    const entry = buildSeedAnnotation(row);
    if (entry) ann[String(row[COL.QA_IDX])] = entry;
  }
  return ann;
}

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

// 진행도/필터는 "사람이 확정한 판정" 기준: 미확정 seed는 미검수로 집계
export function isConfirmed(ann: Annotation | undefined): boolean {
  return !!ann && !ann.seed;
}

export function confirmedStatus(ann: Annotation | undefined): RowStatus {
  return isConfirmed(ann) ? (ann as Annotation).s : "none";
}

export function matchesFilter(
  ann: Annotation | undefined,
  filter: Filter,
): boolean {
  return filter === "all" || confirmedStatus(ann) === filter;
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
