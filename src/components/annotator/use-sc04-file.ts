"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";

import type { FileKey, Sc04File } from "@/lib/sc04";

export function sc04FileQueryOptions(key: FileKey) {
  return queryOptions({
    queryKey: ["sc04", key],
    queryFn: async (): Promise<Sc04File> => {
      const res = await fetch(`/data/${key}.json`);
      if (!res.ok)
        throw new Error(`데이터 로드 실패: ${key}.json (HTTP ${res.status})`);
      return res.json();
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

export function useSc04File(key: FileKey) {
  return useQuery(sc04FileQueryOptions(key));
}
