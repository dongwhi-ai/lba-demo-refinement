import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Annotation, FileKey } from "@/lib/sc04";

export type RemoteAnnotationFiles = Record<FileKey, Record<string, Annotation>>;

export interface RemoteAnnotationSnapshot {
  version: 1;
  tabId: string;
  clientSeq: number;
  updatedAt: string;
  files: RemoteAnnotationFiles;
}

const TAB_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const REMOTE_SCHEMA_VERSION = 1;
const R2_KEY_PREFIX = "annotations/tabs";

const fixCategorySchema = z.enum(["Aa", "Ab", "Ac", "Ba", "Bb", "C"]);
const statusSchema = z.enum(["accept", "fix", "del"]);
const annotationSchema = z.object({
  s: statusSchema,
  c: z.array(fixCategorySchema).optional(),
  m: z.string().optional(),
});
const annotationRecordSchema = z.record(z.string(), annotationSchema);
const annotationFilesSchema = z.object({
  drama: annotationRecordSchema,
  cooking: annotationRecordSchema,
  assembly: annotationRecordSchema,
});
const tabIdInputSchema = z.object({
  tabId: z.string().min(1).max(128).regex(TAB_ID_PATTERN),
});
const saveInputSchema = tabIdInputSchema.extend({
  clientSeq: z.number().int().nonnegative(),
  files: annotationFilesSchema,
});
const snapshotSchema = saveInputSchema.extend({
  version: z.literal(REMOTE_SCHEMA_VERSION),
  updatedAt: z.string(),
});

function annotationObjectKey(tabId: string): string {
  return `${R2_KEY_PREFIX}/${tabId}.json`;
}

async function getBucket(): Promise<R2Bucket> {
  const { env } = await import("cloudflare:workers");
  return env.R2_BUCKET;
}

async function readSnapshot(
  bucket: R2Bucket,
  tabId: string,
): Promise<{ etag: string; snapshot: RemoteAnnotationSnapshot } | null> {
  const object = await bucket.get(annotationObjectKey(tabId));
  if (!object) return null;
  const parsed = snapshotSchema.parse(await object.json());
  return { etag: object.etag, snapshot: parsed };
}

export const loadTabAnnotations = createServerFn({ method: "GET" })
  .inputValidator(tabIdInputSchema)
  .handler(async ({ data }) => {
    const bucket = await getBucket();
    const current = await readSnapshot(bucket, data.tabId);
    if (!current) return { found: false as const };
    return { found: true as const, snapshot: current.snapshot };
  });

export const saveTabAnnotations = createServerFn({ method: "POST" })
  .inputValidator(saveInputSchema)
  .handler(async ({ data }) => {
    const bucket = await getBucket();
    const current = await readSnapshot(bucket, data.tabId);

    if (current && current.snapshot.clientSeq > data.clientSeq) {
      return {
        saved: false as const,
        ignored: true as const,
        snapshot: current.snapshot,
      };
    }

    const next: RemoteAnnotationSnapshot = {
      version: REMOTE_SCHEMA_VERSION,
      tabId: data.tabId,
      clientSeq: data.clientSeq,
      updatedAt: new Date().toISOString(),
      files: data.files,
    };
    const body = JSON.stringify(next);
    const putOptions = {
      httpMetadata: { contentType: "application/json" },
      ...(current ? { onlyIf: { etagMatches: current.etag } } : {}),
    };
    const written = await bucket.put(
      annotationObjectKey(data.tabId),
      body,
      putOptions,
    );

    if (written) {
      return { saved: true as const, ignored: false as const, snapshot: next };
    }

    const latest = await readSnapshot(bucket, data.tabId);
    if (latest && latest.snapshot.clientSeq > data.clientSeq) {
      return {
        saved: false as const,
        ignored: true as const,
        snapshot: latest.snapshot,
      };
    }

    const retried = await bucket.put(annotationObjectKey(data.tabId), body, {
      httpMetadata: { contentType: "application/json" },
      ...(latest ? { onlyIf: { etagMatches: latest.etag } } : {}),
    });

    return {
      saved: Boolean(retried),
      ignored: false as const,
      snapshot: next,
    };
  });
