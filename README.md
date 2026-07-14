# LBA Data Refinement

sc04 video-QA 샘플(드라마/요리/조립, 각 500행)을 한 행씩 보며 **채택 / 수정 / 폐기**를 판정하는 검수용 SPA.

## 실행

```sh
pnpm install
pnpm run dev   # http://localhost:3000
```

## 사용법

- 상단 탭으로 파일(드라마/요리/조립) 전환. 탭에 검수 진행도(`n/500`) 표시.
- 판정: **채택 (1)** / **수정 (2)** / **폐기 (3)**. 수정은 대분류(Aa/Ab/Ac/Ba/Bb/C) 1개 이상 선택 필수, 메모는 선택.
- 채택/폐기/수정 저장 시 현재 필터 기준 다음 행으로 자동 이동.
- 잘못 판정한 행은 상태 스트립(500칸)이나 이동 입력으로 돌아가 다른 판정으로 덮어쓰거나 `검수 취소`.
- 키보드: `1/2/3` 판정, `←/→` 이동, `Enter` 저장, `Esc` 수정 패널 닫기.
- 진행사항은 localStorage(`lba-refine-v1`)에 cache되고, annotation은 파일별 shared R2 object에 저장.
- **xlsx/json 다운로드**: 현재 탭 파일을 다운로드. xlsx는 원본 16열 그대로 + `refinement` 열 기입(채택 → 빈칸, 수정 → `fix, Ab, Ac, 메모`, 폐기 → `del`) + 후미에 `검수상태` 보조열(채택/수정/폐기/미검수, 채택·미검수 구분용 — 불필요하면 열 삭제).

## 데이터 재생성

원본 xlsx는 `data/`에 보관. 변경 시:

```sh
uv run scripts/build_data.py   # data/*.xlsx → public/data/*.json (검증 포함)
```

## Export 검증

앱과 동일한 코드 경로로 xlsx를 만들어 원본과 전수 비교(diff 0 기대):

```sh
pnpm dlx tsx scripts/roundtrip_test.ts drama <annotation.json> /tmp/out.xlsx
uv run scripts/roundtrip_check.py data/sc04_results_drama.xlsx /tmp/out.xlsx <annotation.json>
```
