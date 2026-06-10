"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Filter } from "@/lib/sc04";
import { FILTER_OPTIONS } from "@/lib/sc04";

export function Toolbar({
  idx,
  total,
  qaIdx,
  filter,
  onFilterChange,
  onJump,
  onNextUnreviewed,
  onExportCurrent,
  onExportJson,
  syncStatus,
}: {
  idx: number;
  total: number;
  qaIdx: string;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  onJump: (value: string) => void;
  onNextUnreviewed: () => void;
  onExportCurrent: () => void;
  onExportJson: () => void;
  syncStatus: string;
}) {
  const [jumpValue, setJumpValue] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs tabular-nums">
        #{idx + 1} / {total} · QA_idx {qaIdx}
      </span>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onJump(jumpValue);
          setJumpValue("");
        }}
        className="flex items-center gap-1"
      >
        <Input
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          placeholder="번호/QA_idx"
          className="h-8 w-28"
          inputMode="numeric"
        />
        <Button type="submit" variant="outline" size="sm">
          이동
        </Button>
      </form>
      <Select
        value={filter}
        onValueChange={(value) => onFilterChange(value as Filter)}
        items={FILTER_OPTIONS}
      >
        <SelectTrigger size="sm" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onNextUnreviewed}>
        다음 미검수
      </Button>
      <span className="text-muted-foreground text-xs">{syncStatus}</span>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onExportCurrent}>
          xlsx 다운로드
        </Button>
        <Button variant="outline" size="sm" onClick={onExportJson}>
          json 다운로드
        </Button>
      </div>
    </div>
  );
}
