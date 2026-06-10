"use client";

import * as XLSX from "xlsx";
// Node 테스트 스크립트(scripts/roundtrip_test.ts)에서도 import할 수 있도록 relative import 사용
import type { Annotation, CellValue, Sc04File } from "./sc04";
import { buildRefinement, COL, STATUS_LABELS } from "./sc04";

const SHEET_NAME = "sc04_results";
// refinement 빈칸만으로는 채택과 미검수가 구분되지 않아 후미 보조열로 검수상태를 기록
const STATUS_COLUMN = "검수상태";

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function buildWorkbook(
  data: Sc04File,
  ann: Record<string, Annotation>,
): XLSX.WorkBook {
  const header = [...data.meta.columns, STATUS_COLUMN];
  const body = data.rows.map((row) => {
    const rowAnn = ann[String(row[COL.QA_IDX])];
    const out: (CellValue | null)[] = [...row];
    out[COL.REFINEMENT] = buildRefinement(rowAnn);
    out.push(STATUS_LABELS[rowAnn ? rowAnn.s : "none"]);
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
    `sc04_results_${data.key}_reviewed_${timestamp()}.xlsx`,
  );
}
