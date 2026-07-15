"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  type Annotation,
  FILE_KEYS,
  type FileKey,
  type Filter,
  type PrevFilter,
} from "@/lib/sc04";

// v2: 2차 정제. 1차(lba-refine-v1) localStorage 캐시가 hydrate되지 않도록 키 자체를 변경
const STORAGE_KEY = "lba-refine-v2";

// 손상된 저장값은 backup 키로 보존한 뒤 fresh start
if (typeof window !== "undefined") {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      JSON.parse(raw);
    } catch {
      window.localStorage.setItem(`${STORAGE_KEY}-corrupt-${Date.now()}`, raw);
      window.localStorage.removeItem(STORAGE_KEY);
      window.alert(
        `저장된 진행사항이 손상되어 새로 시작합니다. 원본은 localStorage의 "${STORAGE_KEY}-corrupt-*" 키에 보존했습니다.`,
      );
    }
  }
}

const noopStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

export interface FileAnnState {
  lastIdx: number;
  filter: Filter;
  prevFilter: PrevFilter;
  ann: Record<string, Annotation>;
}

interface AnnotationStore {
  files: Record<FileKey, FileAnnState>;
  // 콜드 스타트 시 마지막 작업 탭 복원용
  activeFile: FileKey;
  setAnnotation: (file: FileKey, qaIdx: string, ann: Annotation) => void;
  clearAnnotation: (file: FileKey, qaIdx: string) => void;
  hydrateAnnotations: (
    files: Record<FileKey, Record<string, Annotation>>,
  ) => void;
  hydrateFileAnnotations: (
    file: FileKey,
    ann: Record<string, Annotation>,
  ) => void;
  setLastIdx: (file: FileKey, idx: number) => void;
  setFilter: (file: FileKey, filter: Filter) => void;
  setPrevFilter: (file: FileKey, prevFilter: PrevFilter) => void;
}

const defaultFileState = (): FileAnnState => ({
  lastIdx: 0,
  filter: "all",
  prevFilter: "all",
  ann: {},
});

export const useAnnotationStore = create<AnnotationStore>()(
  persist(
    (set) => ({
      files: {
        drama: defaultFileState(),
        cooking: defaultFileState(),
        assembly: defaultFileState(),
      },
      activeFile: "drama",
      setAnnotation: (file, qaIdx, ann) =>
        set((state) => ({
          files: {
            ...state.files,
            [file]: {
              ...state.files[file],
              ann: { ...state.files[file].ann, [qaIdx]: ann },
            },
          },
        })),
      clearAnnotation: (file, qaIdx) =>
        set((state) => {
          const { [qaIdx]: _removed, ...rest } = state.files[file].ann;
          return {
            files: {
              ...state.files,
              [file]: { ...state.files[file], ann: rest },
            },
          };
        }),
      hydrateAnnotations: (remoteFiles) =>
        set((state) => ({
          files: Object.fromEntries(
            FILE_KEYS.map((key) => [
              key,
              { ...state.files[key], ann: remoteFiles[key] ?? {} },
            ]),
          ) as Record<FileKey, FileAnnState>,
        })),
      hydrateFileAnnotations: (file, ann) =>
        set((state) => ({
          files: {
            ...state.files,
            [file]: { ...state.files[file], ann },
          },
        })),
      setLastIdx: (file, idx) =>
        set((state) => ({
          activeFile: file,
          files: {
            ...state.files,
            [file]: { ...state.files[file], lastIdx: idx },
          },
        })),
      setFilter: (file, filter) =>
        set((state) => ({
          files: { ...state.files, [file]: { ...state.files[file], filter } },
        })),
      setPrevFilter: (file, prevFilter) =>
        set((state) => ({
          files: {
            ...state.files,
            [file]: { ...state.files[file], prevFilter },
          },
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({
        files: state.files,
        activeFile: state.activeFile,
      }),
    },
  ),
);
