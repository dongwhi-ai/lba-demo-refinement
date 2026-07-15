"""표준 라이브러리만으로 xlsx 시트를 읽는 최소 reader.

build_data.py와 roundtrip_check.py가 공유한다. openpyxl/uv가 없는
공유 연구 서버에서도 python3만으로 동작하는 것이 목적.

지원 셀 타입: shared string(t="s"), inline string(t="inlineStr"),
formula cached string(t="str"), boolean(t="b"), 숫자(기본).
SheetJS(export본)와 openpyxl(원본) 출력 모두 이 범위 안이다.
"""

import re
import zipfile
from xml.etree import ElementTree as ET

_M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_NS = {"m": _M[1:-1]}

CellValue = str | int | float | bool | None


def _col_index(cell_ref: str) -> int:
    m = re.match(r"([A-Z]+)", cell_ref)
    n = 0
    for ch in m.group(1):
        n = n * 26 + ord(ch) - 64
    return n - 1


def _shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return [
        "".join(t.text or "" for t in si.iter(f"{_M}t"))
        for si in root.findall("m:si", _NS)
    ]


def _cell_value(cell: ET.Element, sst: list[str]) -> CellValue:
    cell_type = cell.get("t")
    if cell_type == "inlineStr":
        return "".join(t.text or "" for t in cell.iter(f"{_M}t"))
    v = cell.find("m:v", _NS)
    if v is None or v.text is None:
        return None
    if cell_type == "s":
        return sst[int(v.text)]
    if cell_type in ("str", "e"):
        return v.text
    if cell_type == "b":
        return v.text == "1"
    num = float(v.text)
    return int(num) if num.is_integer() else num


def sheet_names(path: str) -> list[str]:
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("xl/workbook.xml"))
        return [s.get("name") for s in root.find("m:sheets", _NS)]


def read_sheet(path: str, sheet_name: str) -> list[list[CellValue]]:
    """시트를 행 리스트로 반환. 누락 셀은 None, 행 길이는 시트 내 최대 열까지 패딩."""
    with zipfile.ZipFile(path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {r.get("Id"): r.get("Target") for r in rels}
        target = None
        for s in wb.find("m:sheets", _NS):
            if s.get("name") == sheet_name:
                target = rel_targets[s.get(f"{_R}id")]
                break
        if target is None:
            raise KeyError(f"sheet {sheet_name!r} 없음 (있는 시트: {sheet_names(path)})")
        sheet_path = target if target.startswith("xl/") else f"xl/{target.lstrip('/')}"

        sst = _shared_strings(z)
        sheet = ET.fromstring(z.read(sheet_path))
        rows: list[list[CellValue]] = []
        width = 0
        for row_el in sheet.find("m:sheetData", _NS).findall("m:row", _NS):
            row: list[CellValue] = []
            next_col = 0
            for cell in row_el.findall("m:c", _NS):
                ref = cell.get("r")
                col = _col_index(ref) if ref else next_col
                while len(row) < col:
                    row.append(None)
                row.append(_cell_value(cell, sst))
                next_col = col + 1
            width = max(width, len(row))
            rows.append(row)
        for row in rows:
            row.extend([None] * (width - len(row)))
        return rows
