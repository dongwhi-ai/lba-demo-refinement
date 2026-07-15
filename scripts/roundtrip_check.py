"""export된 xlsx를 앱 데이터(JSON)와 전수 비교한다 (2차 정제용, 표준 라이브러리만 사용).

실행: python3 scripts/roundtrip_check.py <public/data/키.json> <export본.xlsx> <annotation.json>
검증: 원본 17열(1차 검수상태/refinement 포함)이 그대로 보존되고,
후미 2열(2차 검수상태 · 2차 refinement)이 검수 규칙과 일치하는지 확인.
(build_data.py가 xlsx→JSON을 검증하므로 JSON 대조로 원본 xlsx까지의 사슬이 이어진다)
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from xlsx_reader import read_sheet, sheet_names

CATEGORY_ORDER = {"Aa": 0, "Ab": 1, "Ac": 2, "Ba": 3, "Bb": 4, "C": 5}
STATUS_LABELS = {"accept": "채택", "fix": "수정", "del": "폐기", None: "미검수"}
ROUND2_COLUMNS = ["2차 검수상태", "2차 refinement"]
QA_IDX_COL = 1  # 0-based


def expected_refinement(ann: dict | None) -> str:
    if ann is None or ann["s"] == "accept":
        return ""
    if ann["s"] == "del":
        return "del"
    cats = sorted(ann.get("c") or [], key=CATEGORY_ORDER.__getitem__)
    memo = (ann.get("m") or "").strip()
    return ", ".join(["fix", *cats, *([memo] if memo else [])])


def main() -> None:
    data_path, export_path, ann_path = sys.argv[1:4]
    data = json.loads(Path(data_path).read_text(encoding="utf-8"))
    ann_map = json.loads(Path(ann_path).read_text(encoding="utf-8"))

    names = sheet_names(export_path)
    assert names == ["sc04_results"], names
    exported = read_sheet(export_path, "sc04_results")

    n_cols = len(data["meta"]["columns"])  # 17
    expected_header = data["meta"]["columns"] + ROUND2_COLUMNS
    expected_rows = len(data["rows"])
    assert len(exported) == expected_rows + 1, (len(exported), expected_rows + 1)

    diffs = []
    # export는 빈 문자열을 빈 셀(None)로 내보냄
    header = [("" if v is None else v) for v in exported[0]]
    if header != expected_header:
        diffs.append((1, "-", "header", expected_header, header))

    for r, (orig_row, exp_row) in enumerate(zip(data["rows"], exported[1:]), start=2):
        exp_row = list(exp_row) + [None] * (n_cols + 2 - len(exp_row))
        for c in range(n_cols):
            o = orig_row[c]
            e = "" if exp_row[c] is None else exp_row[c]
            if o != e or type(o) is not type(e):
                diffs.append((r, c + 1, "mismatch", repr(o), repr(e)))
        qa = str(orig_row[QA_IDX_COL])
        ann = ann_map.get(qa)
        want_status = STATUS_LABELS[ann["s"] if ann else None]
        got_status = "" if exp_row[n_cols] is None else exp_row[n_cols]
        if got_status != want_status:
            diffs.append((r, n_cols + 1, "round2-status", want_status, got_status))
        want_ref = expected_refinement(ann)
        got_ref = "" if exp_row[n_cols + 1] is None else exp_row[n_cols + 1]
        if got_ref != want_ref:
            diffs.append((r, n_cols + 2, "round2-refinement", want_ref, got_ref))

    if diffs:
        print(f"FAIL: {len(diffs)} diffs")
        for d in diffs[:20]:
            print(" ", d)
        sys.exit(1)
    longest = max(
        (len(v) for row in data["rows"] for v in row if isinstance(v, str)),
        default=0,
    )
    print(
        f"OK: diff 0 (rows={expected_rows + 1}, cols={n_cols + 2}, "
        f"longest original str cell={longest} chars intact)"
    )


if __name__ == "__main__":
    main()
