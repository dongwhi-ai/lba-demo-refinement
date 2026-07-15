"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DecisionBar,
  type FixDraft,
} from "@/components/annotator/decision-bar";
import {
  EvidencePanel,
  PrevReviewPanel,
  SampleCard,
} from "@/components/annotator/sample-card";
import { StatusStrip } from "@/components/annotator/status-strip";
import { TabBar } from "@/components/annotator/tab-bar";
import { Toolbar } from "@/components/annotator/toolbar";
import { useSc04File } from "@/components/annotator/use-sc04-file";
import { VideoPanel } from "@/components/annotator/video-panel";
import { Button } from "@/components/ui/button";
import { exportAnnotationsJson } from "@/lib/export-json";
import { exportAnnotatedXlsx } from "@/lib/export-xlsx";
import {
  loadFileAnnotations,
  patchFileAnnotation,
} from "@/lib/remote-annotations";
import type {
  Annotation,
  FileKey,
  Filter,
  PrevFilter,
  Status,
} from "@/lib/sc04";
import {
  COL,
  FILE_KEYS,
  findNextIndex,
  matchesFilter,
  matchesPrevFilter,
  parsePrevStatus,
  parseYoutubeId,
  ROWS_PER_FILE,
  rowStatus,
} from "@/lib/sc04";
import { useAnnotationStore } from "@/stores/annotation";

const routeApi = getRouteApi("/");

type SyncStatus = "loading" | "saving" | "saved" | "error";

const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  loading: "서버 불러오는 중",
  saving: "서버 저장 중",
  saved: "서버 저장됨",
  error: "서버 저장 실패",
};

// 다른 검수자의 판정을 주기적으로 가져오는 간격
const REMOTE_POLL_MS = 30_000;

export function Annotator() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AnnotatorInner />
    </QueryClientProvider>
  );
}

function AnnotatorInner() {
  const { file, i } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const loadRemoteFile = useServerFn(loadFileAnnotations);
  const patchRemoteFile = useServerFn(patchFileAnnotation);
  // SSR markup과 localStorage 반영 후 markup이 달라 hydration mismatch가 나지 않도록 mount 후 렌더
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const query = useSc04File(file);
  const data = query.data;

  const files = useAnnotationStore((state) => state.files);
  const setAnnotation = useAnnotationStore((state) => state.setAnnotation);
  const clearAnnotation = useAnnotationStore((state) => state.clearAnnotation);
  const hydrateAnnotations = useAnnotationStore(
    (state) => state.hydrateAnnotations,
  );
  const setLastIdx = useAnnotationStore((state) => state.setLastIdx);
  const setFilter = useAnnotationStore((state) => state.setFilter);
  const setPrevFilter = useAnnotationStore((state) => state.setPrevFilter);
  const fileState = files[file];
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const localMutationRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const total = data?.rows.length ?? ROWS_PER_FILE;
  const idx = Math.min(Math.max(i - 1, 0), total - 1);
  const row = data?.rows[idx];
  const qaKey = row ? String(row[COL.QA_IDX]) : null;
  const ann = qaKey ? fileState.ann[qaKey] : undefined;
  const currentStatus = rowStatus(ann);

  const [fixDraft, setFixDraft] = useState<FixDraft | null>(null);
  const visibleFixDraft = useMemo(
    () =>
      fixDraft ??
      (currentStatus === "fix"
        ? { cats: ann?.c ?? [], memo: ann?.m ?? "" }
        : null),
    [fixDraft, currentStatus, ann],
  );

  // mount 시 1회 + REMOTE_POLL_MS 주기로 서버 상태를 가져와 다른 검수자의 판정을 반영.
  // 요청 시작 이후 로컬 판정(localMutationRef 증가)이 있었으면 응답을 버려 덮어쓰기를 방지.
  useEffect(() => {
    let cancelled = false;
    const refresh = (initial: boolean) => {
      const mutationVersion = localMutationRef.current;
      if (initial) setSyncStatus("loading");
      Promise.all(
        FILE_KEYS.map(async (key) => {
          const result = await loadRemoteFile({ data: { file: key } });
          return [key, result.found ? result.snapshot.ann : {}] as const;
        }),
      )
        .then((entries) => {
          if (cancelled) return;
          if (localMutationRef.current === mutationVersion) {
            hydrateAnnotations(
              Object.fromEntries(entries) as Record<
                FileKey,
                Record<string, Annotation>
              >,
            );
            setSyncStatus("saved");
          }
        })
        .catch(() => {
          if (cancelled) return;
          // 주기 refresh의 일시 오류는 상태를 바꾸지 않음 (다음 주기에 재시도)
          if (initial) setSyncStatus("error");
        });
    };
    refresh(true);
    const timer = window.setInterval(() => refresh(false), REMOTE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadRemoteFile, hydrateAnnotations]);

  const saveRemoteRow = useCallback(
    (
      targetFile: FileKey,
      targetQaKey: string,
      annotation: Annotation | null,
    ) => {
      localMutationRef.current += 1;
      setSyncStatus("saving");

      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const result = await patchRemoteFile({
            data: {
              file: targetFile,
              qaIdx: targetQaKey,
              annotation,
            },
          });
          setSyncStatus(result.saved ? "saved" : "error");
        })
        .catch(() => setSyncStatus("error"));
    },
    [patchRemoteFile],
  );

  // 기본 URL로 콜드 스타트하면 마지막 작업 위치로 복원 (lastIdx를 덮어쓰는 effect보다 먼저 선언)
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount 시 1회만 실행
  useEffect(() => {
    if (file !== "drama" || i !== 1) return;
    const state = useAnnotationStore.getState();
    const lastFile = state.activeFile;
    const lastIdx = state.files[lastFile].lastIdx;
    if (lastFile !== file || lastIdx !== 0) {
      navigate({ search: { file: lastFile, i: lastIdx + 1 }, replace: true });
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 행 이동 시 수정 패널 초기화
  useEffect(() => setFixDraft(null), [file, idx]);

  useEffect(() => {
    if (mounted) setLastIdx(file, idx);
  }, [mounted, file, idx, setLastIdx]);

  const goTo = useCallback(
    (nextIdx: number) => {
      navigate({ search: { file, i: nextIdx + 1 } });
    },
    [navigate, file],
  );

  const switchTab = (nextFile: FileKey) => {
    const lastIdx = useAnnotationStore.getState().files[nextFile].lastIdx;
    navigate({ search: { file: nextFile, i: lastIdx + 1 } });
  };

  const statusOf = useCallback(
    (rowIdx: number, annMap: typeof fileState.ann) => {
      if (!data) return "none";
      return rowStatus(annMap[String(data.rows[rowIdx][COL.QA_IDX])]);
    },
    [data],
  );

  // 1차 검수상태 필터 매칭 (2차 상태 필터와 AND로 조합)
  const rowMatchesPrev = useCallback(
    (rowIdx: number, prevFilter: PrevFilter) => {
      if (!data) return false;
      return matchesPrevFilter(
        parsePrevStatus(data.rows[rowIdx][COL.PREV_STATUS]),
        prevFilter,
      );
    },
    [data],
  );

  // 판정 직후 최신 store 기준으로 현재 필터에 맞는 다음 행으로 이동 (wrap)
  const advance = useCallback(
    (fromIdx: number) => {
      if (!data) return;
      const state = useAnnotationStore.getState().files[file];
      const next = findNextIndex(
        data.rows.length,
        fromIdx,
        (j) =>
          matchesFilter(
            state.ann[String(data.rows[j][COL.QA_IDX])],
            state.filter,
          ) && rowMatchesPrev(j, state.prevFilter),
        { wrap: true },
      );
      if (next !== null) goTo(next);
    },
    [data, file, goTo, rowMatchesPrev],
  );

  const decide = useCallback(
    (status: Status) => {
      if (!qaKey) return;
      // 수정→채택/폐기 전환 시 카테고리·메모는 보존 (실수 클릭으로 메모가 유실되지 않도록)
      const nextAnn = { s: status, c: ann?.c, m: ann?.m };
      setAnnotation(file, qaKey, nextAnn);
      saveRemoteRow(file, qaKey, nextAnn);
      setFixDraft(null);
      advance(idx);
    },
    [qaKey, file, ann, setAnnotation, saveRemoteRow, advance, idx],
  );

  const openFix = useCallback(() => {
    if (fixDraft) return;
    setFixDraft({ cats: ann?.c ?? [], memo: ann?.m ?? "" });
  }, [fixDraft, ann]);

  const saveFix = useCallback(() => {
    if (!qaKey || !visibleFixDraft || visibleFixDraft.cats.length === 0) {
      return;
    }
    const memo = visibleFixDraft.memo.trim();
    const nextAnn = {
      s: "fix",
      c: visibleFixDraft.cats,
      m: memo === "" ? undefined : memo,
    } satisfies Annotation;
    setAnnotation(file, qaKey, nextAnn);
    saveRemoteRow(file, qaKey, nextAnn);
    setFixDraft(null);
    advance(idx);
  }, [
    qaKey,
    visibleFixDraft,
    file,
    setAnnotation,
    saveRemoteRow,
    advance,
    idx,
  ]);

  const clearCurrent = useCallback(() => {
    if (!qaKey) return;
    clearAnnotation(file, qaKey);
    saveRemoteRow(file, qaKey, null);
    setFixDraft(null);
  }, [qaKey, file, clearAnnotation, saveRemoteRow]);

  const stepTarget = useCallback(
    (direction: 1 | -1) => {
      if (!data) return null;
      return findNextIndex(
        data.rows.length,
        idx,
        (j) =>
          matchesFilter(
            fileState.ann[String(data.rows[j][COL.QA_IDX])],
            fileState.filter,
          ) && rowMatchesPrev(j, fileState.prevFilter),
        { wrap: false, direction },
      );
    },
    [data, idx, fileState, rowMatchesPrev],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      const next = stepTarget(direction);
      if (next !== null) goTo(next);
    },
    [stepTarget, goTo],
  );

  const nextUnreviewed = () => {
    if (!data) return;
    const next = findNextIndex(
      data.rows.length,
      idx,
      (j) =>
        statusOf(j, fileState.ann) === "none" &&
        rowMatchesPrev(j, fileState.prevFilter),
      {
        wrap: true,
      },
    );
    if (next !== null) goTo(next);
  };

  const changeFilter = (filter: Filter) => {
    setFilter(file, filter);
    if (!data) return;
    if (matchesFilter(ann, filter) && rowMatchesPrev(idx, fileState.prevFilter))
      return;
    // 현재 행이 새 필터 조합에 안 맞으면 첫 매칭 행으로 이동
    const first = data.rows.findIndex(
      (r, j) =>
        matchesFilter(fileState.ann[String(r[COL.QA_IDX])], filter) &&
        rowMatchesPrev(j, fileState.prevFilter),
    );
    if (first !== -1) goTo(first);
  };

  const changePrevFilter = (prevFilter: PrevFilter) => {
    setPrevFilter(file, prevFilter);
    if (!data) return;
    if (matchesFilter(ann, fileState.filter) && rowMatchesPrev(idx, prevFilter))
      return;
    const first = data.rows.findIndex(
      (r, j) =>
        matchesFilter(fileState.ann[String(r[COL.QA_IDX])], fileState.filter) &&
        rowMatchesPrev(j, prevFilter),
    );
    if (first !== -1) goTo(first);
  };

  const jump = (value: string) => {
    if (!data) return;
    const n = Number.parseInt(value.trim(), 10);
    if (Number.isNaN(n)) return;
    if (n >= 1 && n <= data.rows.length) {
      goTo(n - 1);
      return;
    }
    const byQaIdx = data.rows.findIndex((r) => Number(r[COL.QA_IDX]) === n);
    if (byQaIdx !== -1) goTo(byQaIdx);
  };

  const exportCurrent = () => {
    if (data) exportAnnotatedXlsx(data, fileState.ann);
  };

  const exportCurrentJson = () => {
    if (data) exportAnnotationsJson(data, fileState.ann);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      switch (e.key) {
        case "1":
          decide("accept");
          break;
        case "2":
          openFix();
          break;
        case "3":
          decide("del");
          break;
        case "ArrowLeft":
          step(-1);
          break;
        case "ArrowRight":
          step(1);
          break;
        case "Enter":
          if (visibleFixDraft) saveFix();
          break;
        case "Escape":
          setFixDraft(null);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decide, openFix, step, visibleFixDraft, saveFix]);

  const statuses = useMemo(
    () =>
      data
        ? data.rows.map((r) => rowStatus(fileState.ann[String(r[COL.QA_IDX])]))
        : [],
    [data, fileState.ann],
  );
  const qaIndices = useMemo(
    () => data?.rows.map((r) => Number(r[COL.QA_IDX])) ?? [],
    [data],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILE_KEYS.map((key) => [key, Object.keys(files[key].ann).length]),
      ) as Record<FileKey, number>,
    [files],
  );

  if (!mounted || query.isPending) {
    return <p className="p-8 text-muted-foreground text-sm">불러오는 중…</p>;
  }
  if (query.isError || !row) {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <p className="text-destructive text-sm">
          데이터를 불러오지 못했습니다: {query.error?.message ?? "행 없음"}
        </p>
        <Button variant="outline" onClick={() => query.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  }

  const videoUrl = String(row[COL.VIDEO_URL]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4">
      <TabBar active={file} counts={counts} onChange={switchTab} />
      <Toolbar
        idx={idx}
        total={total}
        qaIdx={String(row[COL.QA_IDX])}
        filter={fileState.filter}
        prevFilter={fileState.prevFilter}
        onFilterChange={changeFilter}
        onPrevFilterChange={changePrevFilter}
        onJump={jump}
        onNextUnreviewed={nextUnreviewed}
        onExportCurrent={exportCurrent}
        onExportJson={exportCurrentJson}
        syncStatus={SYNC_STATUS_LABELS[syncStatus]}
      />
      <StatusStrip
        statuses={statuses}
        qaIndices={qaIndices}
        currentIdx={idx}
        onJump={goTo}
      />
      <div className="flex flex-col gap-4 md:flex-row">
        <VideoPanel
          videoId={parseYoutubeId(videoUrl)}
          url={videoUrl}
          title={String(row[COL.VIDEO_TITLE])}
          videoType={String(row[COL.VIDEO_TYPE])}
          videoIdx={String(row[COL.VIDEO_IDX])}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <SampleCard row={row} />
          <PrevReviewPanel row={row} />
          <DecisionBar
            status={currentStatus}
            fixDraft={visibleFixDraft}
            onAccept={() => decide("accept")}
            onOpenFix={openFix}
            onDel={() => decide("del")}
            onClear={clearCurrent}
            onDraftChange={setFixDraft}
            onSaveFix={saveFix}
            onCancelFix={() => setFixDraft(null)}
          />
          <EvidencePanel row={row} />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={stepTarget(-1) === null}
              onClick={() => step(-1)}
            >
              ← 이전
            </Button>
            <Button
              variant="outline"
              disabled={stepTarget(1) === null}
              onClick={() => step(1)}
            >
              다음 →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
