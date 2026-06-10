"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { FixCategory, RowStatus } from "@/lib/sc04";
import { FIX_CATEGORIES, STATUS_LABELS } from "@/lib/sc04";

export interface FixDraft {
  cats: FixCategory[];
  memo: string;
}

export function DecisionBar({
  status,
  fixDraft,
  onAccept,
  onOpenFix,
  onDel,
  onClear,
  onDraftChange,
  onSaveFix,
  onCancelFix,
}: {
  status: RowStatus;
  fixDraft: FixDraft | null;
  onAccept: () => void;
  onOpenFix: () => void;
  onDel: () => void;
  onClear: () => void;
  onDraftChange: (draft: FixDraft) => void;
  onSaveFix: () => void;
  onCancelFix: () => void;
}) {
  const toggleCat = (cat: FixCategory, checked: boolean) => {
    if (!fixDraft) return;
    const cats = checked
      ? [...fixDraft.cats, cat]
      : fixDraft.cats.filter((c) => c !== cat);
    onDraftChange({ ...fixDraft, cats });
  };

  return (
    <div className="flex flex-col gap-3 border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={status === "accept" ? "default" : "outline"}
          aria-pressed={status === "accept"}
          onClick={onAccept}
        >
          채택 (1)
        </Button>
        <Button
          variant={status === "fix" ? "default" : "outline"}
          aria-pressed={status === "fix"}
          onClick={onOpenFix}
        >
          수정 (2)
        </Button>
        <Button
          variant={status === "del" ? "destructive" : "outline"}
          aria-pressed={status === "del"}
          onClick={onDel}
        >
          폐기 (3)
        </Button>
        <span className="text-muted-foreground text-xs">
          현재: {STATUS_LABELS[status]}
        </span>
        {status !== "none" && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            검수 취소
          </Button>
        )}
      </div>
      {fixDraft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveFix();
          }}
          className="flex flex-col gap-2 border-t pt-3"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {FIX_CATEGORIES.map((cat) => (
              // biome-ignore lint/a11y/noLabelWithoutControl: Base UI Checkbox(labelable button)가 label 내부에 있음
              <label
                key={cat.value}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <Checkbox
                  checked={fixDraft.cats.includes(cat.value)}
                  onCheckedChange={(checked) =>
                    toggleCat(cat.value, checked === true)
                  }
                />
                <span className="w-5 font-medium font-mono">{cat.value}</span>
                {cat.label}
              </label>
            ))}
          </div>
          <Input
            value={fixDraft.memo}
            onChange={(e) =>
              onDraftChange({ ...fixDraft, memo: e.target.value })
            }
            placeholder="간단한 이유 (선택)"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={fixDraft.cats.length === 0}>
              저장 (Enter)
            </Button>
            <Button type="button" variant="ghost" onClick={onCancelFix}>
              닫기 (Esc)
            </Button>
            {fixDraft.cats.length === 0 && (
              <span className="text-muted-foreground text-xs">
                카테고리를 1개 이상 선택하세요
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
