// 앱의 실제 export 코드 경로(buildWorkbook)로 xlsx를 생성해 /tmp에 저장.
// 이후 scripts/roundtrip_check.py가 앱 데이터(JSON)와 전수 비교한다.
// 실행: node --experimental-strip-types scripts/roundtrip_test.ts <fileKey> <annotationJsonPath> <outPath>

import * as fs from "node:fs";

import * as XLSX from "xlsx";

import { buildWorkbook } from "../src/lib/export-xlsx.ts";
import type { Annotation, Sc04File } from "../src/lib/sc04.ts";

// SheetJS ESM 빌드는 Node에서 fs 주입이 있어야 writeFile이 동작
XLSX.set_fs(fs);
const { readFileSync } = fs;

const [fileKey, annPath, outPath] = process.argv.slice(2);
if (!fileKey || !annPath || !outPath) {
  console.error(
    "usage: node scripts/roundtrip_test.ts <fileKey> <annotationJsonPath> <outPath>",
  );
  process.exit(1);
}

const data: Sc04File = JSON.parse(
  readFileSync(`public/data/${fileKey}.json`, "utf8"),
);
const ann: Record<string, Annotation> = JSON.parse(
  readFileSync(annPath, "utf8"),
);

XLSX.writeFile(buildWorkbook(data, ann), outPath);
console.log(
  `wrote ${outPath} (rows=${data.rows.length}, annotated=${Object.keys(ann).length})`,
);
