"use client";

import type { Annotation, Sc04File } from "@/lib/sc04";
import { buildRefinement, COL, rowStatus, STATUS_LABELS } from "@/lib/sc04";

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function exportAnnotationsJson(
  data: Sc04File,
  ann: Record<string, Annotation>,
): void {
  const payload = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    file: data.key,
    label: data.label,
    sourceFile: data.sourceFile,
    rows: data.rows.map((row) => {
      const qaIdx = String(row[COL.QA_IDX]);
      const rowAnn = ann[qaIdx];
      return {
        qaIdx,
        // 1차 정제 결과 (원본 xlsx의 검수상태/refinement 열)
        prev: {
          status: String(row[COL.PREV_STATUS] ?? ""),
          refinement: String(row[COL.REFINEMENT] ?? ""),
        },
        status: rowStatus(rowAnn),
        statusLabel: STATUS_LABELS[rowStatus(rowAnn)],
        categories: rowAnn?.c ?? [],
        memo: rowAnn?.m ?? "",
        refinement: buildRefinement(rowAnn),
      };
    }),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sc04_results_${data.key}_round2_${timestamp()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
