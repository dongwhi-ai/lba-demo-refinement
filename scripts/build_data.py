"""data/sc04_results_refinement_v1.5.xlsx -> public/data/*.json 변환 + 검증 (2차 정제용).

실행: python3 scripts/build_data.py  (표준 라이브러리만 사용 — uv/openpyxl 불필요)

1차 정제 결과가 통합된 단일 xlsx(17열: 기존 16열 + 검수상태가 N열에 삽입)를
영상 유형별로 분리해 기존과 동일한 public/data/{drama,cooking,assembly}.json을 생성한다.
시트 내 행 순서는 유지된다 (파일럿 75행 블록 + 본검수 750행 블록).
"""

import datetime
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from xlsx_reader import read_sheet, sheet_names

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_VERSION = 2
SOURCE_FILE = "sc04_results_refinement_v1.5.xlsx"
SHEET_NAME = "sc04_results"
EXPECTED_COLUMNS = [
    "video_idx",
    "QA_idx",
    "영상 유형",
    "영상 제목",
    "영상 링크",
    "질문 유형",
    "질문",
    "객관식 후보1",
    "객관식 후보2",
    "객관식 후보3",
    "객관식 후보4",
    "객관식 후보5",
    "정답",
    "검수상태",
    "refinement",
    "근거",
    "비고",
]
EXPECTED_ROWS_PER_FILE = 825
MAX_CELL_LEN = 32000  # xlsx 한계 32767 대비 tripwire
QA_IDX_COL = 1
TYPE_COL = 2
URL_COL = 4
PREV_STATUS_COL = 13
REFINEMENT_COL = 14

# 영상 유형 값 -> 파일 key. 라벨/출력 경로는 1차 도구와 동일하게 유지.
TYPE_KEY = {"Drama": "drama", "Cooking": "cooking", "Assembly": "assembly"}
FILE_LABELS = {"drama": "드라마", "cooking": "요리", "assembly": "조립"}
PREV_STATUSES = {"채택", "수정", "폐기"}

# src/lib/sc04.ts의 parseYoutubeId와 동일한 패턴 유지
YOUTUBE_PATTERNS = [
    re.compile(r"youtube\.com/shorts/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/watch\?.*v=([A-Za-z0-9_-]{11})"),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/embed/([A-Za-z0-9_-]{11})"),
]


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def check_refinement_consistency(qa_idx, prev_status: str, refinement: str) -> None:
    if prev_status == "채택" and refinement != "":
        fail(f"QA_idx={qa_idx}: 채택인데 refinement={refinement!r}")
    if prev_status == "폐기" and refinement != "del":
        fail(f"QA_idx={qa_idx}: 폐기인데 refinement={refinement!r}")
    if prev_status == "수정" and not refinement.startswith("fix, "):
        fail(f"QA_idx={qa_idx}: 수정인데 refinement={refinement!r}")


def main() -> None:
    path = ROOT / "data" / SOURCE_FILE
    if not path.exists():
        fail(f"{path} 없음")
    names = sheet_names(str(path))
    if names != [SHEET_NAME]:
        fail(f"{SOURCE_FILE}: 시트 구성 {names} != [{SHEET_NAME!r}]")

    raw_rows = read_sheet(str(path), SHEET_NAME)
    header = [c for c in raw_rows[0][: len(EXPECTED_COLUMNS)]]
    if header != EXPECTED_COLUMNS:
        fail(f"{SOURCE_FILE}: 헤더 불일치\n  expected={EXPECTED_COLUMNS}\n  actual={header}")

    buckets: dict[str, list] = {key: [] for key in TYPE_KEY.values()}
    qa_indices = set()
    video_ids: dict[str, set] = {key: set() for key in TYPE_KEY.values()}
    max_len = 0
    url_warnings = 0
    for raw in raw_rows[1:]:
        row = list(raw[: len(EXPECTED_COLUMNS)])
        row = [("" if v is None else v) for v in row]
        for v in row:
            if isinstance(v, str):
                max_len = max(max_len, len(v))
                if len(v) >= MAX_CELL_LEN:
                    fail(f"{SOURCE_FILE}: 셀 길이 {len(v)} >= {MAX_CELL_LEN}")
        qa_idx = row[QA_IDX_COL]
        if qa_idx == "":
            fail(f"{SOURCE_FILE}: QA_idx 빈 값")
        if qa_idx in qa_indices:
            fail(f"{SOURCE_FILE}: QA_idx 중복 {qa_idx}")
        qa_indices.add(qa_idx)

        video_type = str(row[TYPE_COL])
        if video_type not in TYPE_KEY:
            fail(f"QA_idx={qa_idx}: 알 수 없는 영상 유형 {video_type!r}")
        key = TYPE_KEY[video_type]

        prev_status = str(row[PREV_STATUS_COL])
        if prev_status not in PREV_STATUSES:
            fail(f"QA_idx={qa_idx}: 검수상태 {prev_status!r} not in {PREV_STATUSES}")
        check_refinement_consistency(qa_idx, prev_status, str(row[REFINEMENT_COL]))

        url = str(row[URL_COL])
        for pat in YOUTUBE_PATTERNS:
            m = pat.search(url)
            if m:
                video_ids[key].add(m.group(1))
                break
        else:
            url_warnings += 1
            print(f"WARN: QA_idx={qa_idx}: YouTube id 파싱 실패: {url}")

        buckets[key].append(row)

    built_at = (
        datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds")
    )
    for key, rows in buckets.items():
        if len(rows) != EXPECTED_ROWS_PER_FILE:
            fail(f"{key}: 행 수 {len(rows)} != {EXPECTED_ROWS_PER_FILE}")
        out = {
            "meta": {
                "schemaVersion": SCHEMA_VERSION,
                "builtAt": built_at,
                "columns": EXPECTED_COLUMNS,
            },
            "key": key,
            "label": FILE_LABELS[key],
            "sourceFile": SOURCE_FILE,
            "rows": rows,
        }
        out_path = ROOT / "public" / "data" / f"{key}.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        size_kb = out_path.stat().st_size / 1024
        print(
            f"{key:9s} rows={len(rows)} videos={len(video_ids[key])} "
            f"-> {out_path.relative_to(ROOT)} ({size_kb:.0f} KB)"
        )
    print(f"total rows={len(qa_indices)} max_cell_len={max_len} url_warn={url_warnings}")
    print("OK")


if __name__ == "__main__":
    main()
