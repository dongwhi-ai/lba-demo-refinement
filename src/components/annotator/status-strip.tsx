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

export const StatusStrip = memo(function StatusStrip({
  statuses,
  qaIndices,
  currentIdx,
  onJump,
}: {
  statuses: RowStatus[];
  qaIndices: number[];
  currentIdx: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(50,minmax(0,1fr))] gap-px border p-1">
      {statuses.map((status, idx) => (
        <button
          type="button"
          key={qaIndices[idx]}
          title={`#${idx + 1} · QA_idx ${qaIndices[idx]} · ${STATUS_LABELS[status]}`}
          onClick={() => onJump(idx)}
          className={cn(
            "h-3 w-full",
            STATUS_CLASS[status],
            idx === currentIdx && "ring-2 ring-ring",
          )}
        />
      ))}
    </div>
  );
});
