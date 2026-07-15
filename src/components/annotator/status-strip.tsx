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
  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-1 border p-1">
      {videoGroups(videoIndices).map((group) => (
        <div key={group.start} className="flex gap-px">
          {statuses.slice(group.start, group.end + 1).map((status, offset) => {
            const idx = group.start + offset;
            return (
              <button
                type="button"
                key={qaIndices[idx]}
                title={`#${idx + 1} · 영상 ${videoIndices[idx]} · QA_idx ${qaIndices[idx]} · ${STATUS_LABELS[status]}${seeds[idx] ? " (1차 seed 미확정)" : ""}`}
                onClick={() => onJump(idx)}
                className={cn(
                  "h-3 w-2",
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
  );
});
