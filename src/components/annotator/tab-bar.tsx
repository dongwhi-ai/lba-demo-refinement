"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FileKey } from "@/lib/sc04";
import { FILE_KEYS, FILE_LABELS, ROWS_PER_FILE } from "@/lib/sc04";

export function TabBar({
  active,
  counts,
  onChange,
}: {
  active: FileKey;
  counts: Record<FileKey, number>;
  onChange: (file: FileKey) => void;
}) {
  return (
    <Tabs value={active} onValueChange={(value) => onChange(value as FileKey)}>
      <TabsList className="w-full">
        {FILE_KEYS.map((key) => (
          <TabsTrigger key={key} value={key}>
            {FILE_LABELS[key]}
            <span className="text-muted-foreground tabular-nums">
              {counts[key]}/{ROWS_PER_FILE}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
