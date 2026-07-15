# LBA Demo Data Refinement (2차)

sc04 video-QA 샘플(드라마/요리/조립, 각 825행)을 한 행씩 보며 **채택 / 수정 / 폐기**를 판정하는 검수용 웹앱.

2차 정제 라운드: 1차 결과가 통합된 `data/sc04_results_refinement_v1.5.xlsx`(2,475행, 17열 — `정답` 뒤에 1차 `검수상태` 열 삽입)를 대상으로, **1차 판정(검수상태·refinement)을 읽기 전용으로 참조하면서** 동일한 채택/수정/폐기 UI로 다시 분류한다. 2차 annotation은 **1차 판정이 seed로 미리 채워진 상태**에서 시작하며(`seed` 플래그), 검수자가 판정 키를 눌러 확정하면 seed 플래그가 해제된다. 진행도·미검수 집계는 "사람이 확정한 행" 기준이다.

## 실행 (연구 서버 self-host)

Cloudflare 배포 대신 연구 서버의 단일 프로세스로 서빙한다. annotation은 workerd(miniflare)의
로컬 R2 시뮬레이션(`.wrangler/state/v3/`)에 저장되며, 모든 검수자가 같은 프로세스를 쓰므로 실시간 공유된다.

```sh
pnpm install
pnpm run build
node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 4173
```

상시 구동은 systemd user 서비스로 관리 (서버에 설정 완료):

```sh
systemctl --user status lba-annotator    # vite preview :4173
systemctl --user restart lba-annotator   # 코드/데이터 변경 후 build 하고 재시작
systemctl --user list-timers lba-backup* # 매시간 .wrangler/state → ~/lba-backups 백업
```

접속: `http://<서버IP>:4173` (예: LAN `http://147.46.15.188:4173`, Tailscale `http://100.114.97.22:4173`).
`pnpm run deploy`(Cloudflare 배포)는 이번 라운드에서 사용하지 않는다.

개발 모드는 기존과 동일: `pnpm run dev` (http://localhost:3000).

## 사용법

- 상단 탭으로 파일(드라마/요리/조립) 전환. 탭에 검수 진행도(`n/825`, **확정한 행 기준**) 표시.
- 모든 행은 1차 판정으로 **미리 선택(seed)** 되어 있음. 판정 버튼에 "1차 seed 미확정" 표시가 보이면 아직 확정 전 — 동의하면 같은 판정 키(채택 `1` / 수정 `2`+`Enter` / 폐기 `3`)를 눌러 확정, 다르게 판단하면 다른 판정을 선택.
- 문항 카드 아래 **1차 검수** 패널에 1차 판정(채택/수정/폐기 배지 + 수정 카테고리 + 메모)이 읽기 전용으로 표시.
- 판정: **채택 (1)** / **수정 (2)** / **폐기 (3)**. 수정은 대분류(Aa/Ab/Ac/Ba/Bb/C) 1개 이상 선택 필수, 메모는 선택(수정 seed는 1차 카테고리·메모가 미리 채워짐).
- 채택/폐기/수정 저장 시 현재 필터 기준 다음 행으로 자동 이동.
- 필터 2개: **1차 상태 필터**(1차 전체/채택/수정/폐기) × **2차 상태 필터**(전체/미검수/채택/수정/폐기). "미검수"는 미확정 seed 포함. 이동/다음 미검수는 두 필터의 AND 기준.
- 상태 스트립: **영상 단위로 그룹**되어 영상이 바뀌는 지점마다 간격이 있음. 미확정 seed는 옅은 색, 확정 판정은 진한 색. 툴팁에 `#위치 · 영상 · QA_idx · 상태` 표시. 툴바에도 현재 영상 번호 표시.
- 잘못 판정한 행은 상태 스트립이나 이동 입력으로 돌아가 다른 판정으로 덮어쓰거나 `검수 취소`.
- 키보드: `1/2/3` 판정, `←/→` 이동, `Enter` 저장, `Esc` 수정 패널 닫기.
- 진행사항은 localStorage(`lba-refine-v2`)에 cache되고, annotation은 파일별 shared object(서버의 R2 시뮬레이션, `annotations/round2/files/*`)에 저장. 30초마다 서버 상태를 polling해 다른 검수자의 판정을 반영. 서버가 비어 있으면 접속한 클라이언트가 1차 판정 seed를 자동으로 채움(이미 저장된 판정은 보존).
- **xlsx/json 다운로드**: 현재 탭 파일을 다운로드. xlsx는 원본 17열(1차 검수상태/refinement 포함)을 그대로 보존하고 후미에 `2차 검수상태`(채택/수정/폐기/미검수) + `2차 refinement`(채택 → 빈칸, 수정 → `fix, Ab, Ac, 메모`, 폐기 → `del`) 2열을 추가(미확정 seed도 값 그대로 기록). json에는 행별 `seeded` 플래그가 추가되어 확정 여부를 구분할 수 있음.

## 데이터 재생성

원본 xlsx는 `data/`에 보관. 변경 시 (표준 라이브러리만 사용, uv/openpyxl 불필요):

```sh
python3 scripts/build_data.py   # data/sc04_results_refinement_v1.5.xlsx → public/data/*.json (검증 포함)
```

## Export 검증

앱과 동일한 코드 경로로 xlsx를 만들어 앱 데이터(JSON)와 전수 비교(diff 0 기대):

```sh
node --experimental-strip-types scripts/roundtrip_test.ts cooking <annotation.json> /tmp/out.xlsx
python3 scripts/roundtrip_check.py public/data/cooking.json /tmp/out.xlsx <annotation.json>
```

## annotation 백업/복원

- 매시간 `~/lba-backups/state-<ts>.tar.gz` 자동 백업 (`scripts/backup_state.sh`, systemd user timer).
- 복원: `systemctl --user stop lba-annotator` → `tar -xzf <백업> -C ~/projects/LBA_demo_refinement` → `systemctl --user start lba-annotator`.
