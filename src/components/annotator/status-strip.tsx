"use client";

import { memo } from "react";
import type { RowStatus } from "@/lib/sc04";
import { STATUS_LABELS } from "@/lib/sc04";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<RowStatus, string> = {
  none: "bg-muted hover:bg-muted-foreground/40",
  accept: "bg-green-500/80 hover:bg-green-500",
  fix: "bg-amber-400/80 hover:bg-amber-400",
  del: "bg-red-500/80 hover:bg-red-500",
};

// 한 줄에 표시할 영상 수 (영상당 25문항 → 50칸/줄)
const VIDEOS_PER_ROW = 2;

// 같은 video_idx가 연속된 구간을 하나의 세그먼트로 묶는다
function videoGroups(videoIndices: number[]): { start: number; end: number }[] {
  const groups: { start: number; end: number }[] = [];
  for (let i = 0; i < videoIndices.length; i++) {
    const last = groups[groups.length - 1];
    if (last && videoIndices[i] === videoIndices[last.start]) {
      last.end = i;
    } else {
      groups.push({ start: i, end: i });
    }
  }
  return groups;
}

export const StatusStrip = memo(function StatusStrip({
  statuses,
  seeds,
  qaIndices,
  videoIndices,
  currentIdx,
  onJump,
}: {
  statuses: RowStatus[];
  seeds: boolean[];
  qaIndices: number[];
  videoIndices: number[];
  currentIdx: number;
  onJump: (idx: number) => void;
}) {
  const groups = videoGroups(videoIndices);
  // 영상 VIDEOS_PER_ROW개씩 한 줄로 묶는다 (영상 사이 간격은 유지)
  const rows: { start: number; end: number }[][] = [];
  for (let i = 0; i < groups.length; i += VIDEOS_PER_ROW) {
    rows.push(groups.slice(i, i + VIDEOS_PER_ROW));
  }

  return (
    <div className="flex flex-col gap-1 border p-1">
      {rows.map((rowGroups) => (
        // 영상 2개를 좌우로 꽉 채우도록 2열 그리드 (마지막 줄 1개 영상은 왼쪽 절반 유지)
        <div key={rowGroups[0].start} className="grid grid-cols-2 gap-2">
          {rowGroups.map((group) => (
            <div key={group.start} className="flex gap-px">
              {statuses
                .slice(group.start, group.end + 1)
                .map((status, offset) => {
                  const idx = group.start + offset;
                  return (
                    <button
                      type="button"
                      key={qaIndices[idx]}
                      title={`#${idx + 1} · 영상 ${videoIndices[idx]} · QA_idx ${qaIndices[idx]} · ${STATUS_LABELS[status]}${seeds[idx] ? " (1차 seed 미확정)" : ""}`}
                      onClick={() => onJump(idx)}
                      className={cn(
                        "h-5 min-w-0 flex-1",
                        STATUS_CLASS[status],
                        // 미확정 seed는 옅은 색으로 확정 판정과 구분
                        seeds[idx] && "opacity-40 hover:opacity-80",
                        idx === currentIdx && "ring-2 ring-ring",
                      )}
                    />
                  );
                })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});
