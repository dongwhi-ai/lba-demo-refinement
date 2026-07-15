"use client";

import * as XLSX from "xlsx";
// Node 테스트 스크립트(scripts/roundtrip_test.ts)에서도 import할 수 있도록
// relative + .ts 확장자 import 사용 (node --experimental-strip-types 요건)
import type { Annotation, CellValue, Sc04File } from "./sc04.ts";
import { buildRefinement, COL, STATUS_LABELS } from "./sc04.ts";

const SHEET_NAME = "sc04_results";
// 1차 결과가 든 원본 17열은 그대로 보존하고, 2차 판정은 후미 2열로만 기록한다.
// (refinement 빈칸만으로는 채택과 미검수가 구분되지 않아 검수상태 열을 함께 기록)
const ROUND2_STATUS_COLUMN = "2차 검수상태";
const ROUND2_REFINEMENT_COLUMN = "2차 refinement";

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function buildWorkbook(
  data: Sc04File,
  ann: Record<string, Annotation>,
): XLSX.WorkBook {
  const header = [
    ...data.meta.columns,
    ROUND2_STATUS_COLUMN,
    ROUND2_REFINEMENT_COLUMN,
  ];
  const body = data.rows.map((row) => {
    const rowAnn = ann[String(row[COL.QA_IDX])];
    const out: (CellValue | null)[] = [...row];
    out.push(STATUS_LABELS[rowAnn ? rowAnn.s : "none"]);
    out.push(buildRefinement(rowAnn));
    // 빈 문자열은 null로 바꿔 원본처럼 빈 셀로 export
    return out.map((v) => (v === "" ? null : v));
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  return wb;
}

export function exportAnnotatedXlsx(
  data: Sc04File,
  ann: Record<string, Annotation>,
): void {
  XLSX.writeFile(
    buildWorkbook(data, ann),
    `sc04_results_${data.key}_round2_${timestamp()}.xlsx`,
  );
}
