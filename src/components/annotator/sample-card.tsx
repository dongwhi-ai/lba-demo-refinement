"use client";

import { Badge } from "@/components/ui/badge";
import type { Sc04Row } from "@/lib/sc04";
import { CHOICE_COUNT, COL } from "@/lib/sc04";
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
