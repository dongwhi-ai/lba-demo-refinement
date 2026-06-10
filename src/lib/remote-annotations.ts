import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { type Annotation, FILE_KEYS, type FileKey } from "@/lib/sc04";

export interface RemoteAnnotationFileSnapshot {
  version: 1;
  file: FileKey;
  updatedAt: string;
  ann: Record<string, Annotation>;
}

const REMOTE_SCHEMA_VERSION = 1;
const R2_KEY_PREFIX = "annotations/files";

const fileKeySchema = z.enum(FILE_KEYS);
const fixCategorySchema = z.enum(["Aa", "Ab", "Ac", "Ba", "Bb", "C"]);
const statusSchema = z.enum(["accept", "fix", "del"]);
const annotationSchema = z.object({
  s: statusSchema,
  c: z.array(fixCategorySchema).optional(),
  m: z.string().optional(),
});
const annotationRecordSchema = z.record(z.string(), annotationSchema);
const fileInputSchema = z.object({
  file: fileKeySchema,
});
const patchInputSchema = fileInputSchema.extend({
  qaIdx: z.string().min(1).max(64),
  annotation: annotationSchema.nullable(),
});
const snapshotSchema = z.object({
  version: z.literal(REMOTE_SCHEMA_VERSION),
  file: fileKeySchema,
  updatedAt: z.string(),
  ann: annotationRecordSchema,
});

function annotationObjectKey(file: FileKey): string {
  return `${R2_KEY_PREFIX}/${file}.json`;
}

async function getBucket(): Promise<R2Bucket> {
  const { env } = await import("cloudflare:workers");
  return env.R2_BUCKET;
}

async function readSnapshot(
  bucket: R2Bucket,
  file: FileKey,
): Promise<{ etag: string; snapshot: RemoteAnnotationFileSnapshot } | null> {
  const object = await bucket.get(annotationObjectKey(file));
  if (!object) return null;
  const parsed = snapshotSchema.parse(await object.json());
  return { etag: object.etag, snapshot: parsed };
}

function applyAnnotationPatch(
  ann: Record<string, Annotation>,
  qaIdx: string,
  annotation: Annotation | null,
): Record<string, Annotation> {
  const next = { ...ann };
  if (annotation) {
    next[qaIdx] = annotation;
  } else {
    delete next[qaIdx];
  }
  return next;
}

function createSnapshot(
  file: FileKey,
  ann: Record<string, Annotation>,
): RemoteAnnotationFileSnapshot {
  return {
    version: REMOTE_SCHEMA_VERSION,
    file,
    updatedAt: new Date().toISOString(),
    ann,
  };
}

async function writeSnapshot(
  bucket: R2Bucket,
  snapshot: RemoteAnnotationFileSnapshot,
  etag: string | null,
): Promise<R2Object | null> {
  return bucket.put(
    annotationObjectKey(snapshot.file),
    JSON.stringify(snapshot),
    {
      httpMetadata: { contentType: "application/json" },
      onlyIf: etag ? { etagMatches: etag } : { etagDoesNotMatch: "*" },
    },
  );
}

export const loadFileAnnotations = createServerFn({ method: "GET" })
  .inputValidator(fileInputSchema)
  .handler(async ({ data }) => {
    const bucket = await getBucket();
    const current = await readSnapshot(bucket, data.file);
    if (!current) return { found: false as const };
    return { found: true as const, snapshot: current.snapshot };
  });

export const patchFileAnnotation = createServerFn({ method: "POST" })
  .inputValidator(patchInputSchema)
  .handler(async ({ data }) => {
    const bucket = await getBucket();

    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readSnapshot(bucket, data.file);
      const next = createSnapshot(
        data.file,
        applyAnnotationPatch(
          current?.snapshot.ann ?? {},
          data.qaIdx,
          data.annotation,
        ),
      );
      const written = await writeSnapshot(bucket, next, current?.etag ?? null);
      if (written) {
        return { saved: true as const, snapshot: next };
      }
    }

    const latest = await readSnapshot(bucket, data.file);
    return {
      saved: false as const,
      snapshot: latest?.snapshot ?? createSnapshot(data.file, {}),
    };
  });
