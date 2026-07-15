"use client";

import { Badge } from "@/components/ui/badge";
import type { FixCategory, Sc04Row, Status } from "@/lib/sc04";
import {
  CHOICE_COUNT,
  COL,
  FIX_CATEGORIES,
  parsePrevStatus,
  parseRefinement,
  STATUS_LABELS,
} from "@/lib/sc04";
import { cn } from "@/lib/utils";

function EmptyValue({ label }: { label: string }) {
  return <span className="text-muted-foreground italic">({label})</span>;
}

export function SampleCard({ row }: { row: Sc04Row }) {
  const question = String(row[COL.QUESTION] ?? "");
  const rawAnswer = row[COL.ANSWER];
  const answerNum =
    typeof rawAnswer === "number"
      ? rawAnswer
      : Number.parseInt(String(rawAnswer), 10) || null;
  const choices = Array.from({ length: CHOICE_COUNT }, (_, i) =>
    String(row[COL.CHOICE_1 + i] ?? ""),
  );

  return (
    <div className="flex flex-col gap-3 border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {String(row[COL.QUESTION_TYPE]) || "유형 없음"}
        </Badge>
        <span className="text-muted-foreground text-xs">
          QA_idx {row[COL.QA_IDX]}
        </span>
      </div>
      <p className="font-medium text-sm leading-relaxed">
        {question || <EmptyValue label="질문 비어 있음" />}
      </p>
      {choices.some((choice) => choice !== "") ? (
        <ol className="flex flex-col gap-1">
          {choices.map(
            (choice, i) =>
              choice !== "" && (
                <li
                  key={`${row[COL.QA_IDX]}-${
                    // biome-ignore lint/suspicious/noArrayIndexKey: 선택지는 고정 위치(1~5)
                    i
                  }`}
                  className={cn(
                    "border px-2 py-1.5 text-xs leading-relaxed",
                    i + 1 === answerNum &&
                      "border-green-600 bg-green-500/10 font-medium",
                  )}
                >
                  <span className="mr-1.5 text-muted-foreground tabular-nums">
                    {i + 1}.
                  </span>
                  {choice}
                  {i + 1 === answerNum && (
                    <span className="ml-1.5 text-green-700">✓ 정답</span>
                  )}
                </li>
              ),
          )}
        </ol>
      ) : (
        <EmptyValue label="선택지 없음" />
      )}
      {answerNum === null && (
        <p className="text-destructive text-xs">정답 없음</p>
      )}
    </div>
  );
}

const PREV_STATUS_CLASS: Record<Status, string> = {
  accept: "border-green-600 bg-green-500/10 text-green-700",
  fix: "border-amber-500 bg-amber-400/10 text-amber-700",
  del: "border-red-600 bg-red-500/10 text-red-700",
};

const FIX_CATEGORY_LABELS = Object.fromEntries(
  FIX_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<FixCategory, string>;

// 1차 정제 결과(검수상태/refinement 열)를 읽기 전용으로 표시
export function PrevReviewPanel({ row }: { row: Sc04Row }) {
  const prev = parsePrevStatus(row[COL.PREV_STATUS]);
  const refinement = String(row[COL.REFINEMENT] ?? "");
  const { cats, memo } =
    prev === "fix" ? parseRefinement(refinement) : { cats: [], memo: "" };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border border-dashed px-2 py-1.5 text-xs">
      <span className="mr-0.5 font-medium text-muted-foreground">1차 검수</span>
      {prev ? (
        <Badge variant="outline" className={PREV_STATUS_CLASS[prev]}>
          {STATUS_LABELS[prev]}
        </Badge>
      ) : (
        <EmptyValue label="상태 없음" />
      )}
      {cats.map((cat) => (
        <Badge key={cat} variant="secondary">
          {cat} · {FIX_CATEGORY_LABELS[cat]}
        </Badge>
      ))}
      {memo !== "" && (
        <span className="whitespace-pre-wrap leading-relaxed">{memo}</span>
      )}
    </div>
  );
}

export function EvidencePanel({ row }: { row: Sc04Row }) {
  const rationale = String(row[COL.RATIONALE] ?? "");
  const note = String(row[COL.NOTE] ?? "");
  let prettyNote = note;
  try {
    prettyNote = JSON.stringify(JSON.parse(note), null, 2);
  } catch {
    // JSON이 아니면 raw 그대로
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <details open className="border p-2">
        <summary className="cursor-pointer select-none font-medium">
          근거
        </summary>
        <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">
          {rationale || <EmptyValue label="없음" />}
        </p>
      </details>
      <details className="border p-2">
        <summary className="cursor-pointer select-none font-medium">
          비고
        </summary>
        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {prettyNote || "(없음)"}
        </pre>
      </details>
    </div>
  );
}
