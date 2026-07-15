#!/usr/bin/env bash
# annotation 상태(.wrangler/state = 로컬 R2 시뮬레이션)를 ~/lba-backups에 tar로 백업.
# systemd user timer(lba-backup.timer)가 매시간 실행하며, 30일 지난 백업은 정리한다.
# 복원: 서비스 중지 -> tar -xzf <백업> -C ~/projects/LBA_demo_refinement -> 서비스 시작
set -euo pipefail

PROJECT_DIR="$HOME/projects/LBA_demo_refinement"
BACKUP_DIR="$HOME/lba-backups"
STATE_DIR="$PROJECT_DIR/.wrangler/state"

[ -d "$STATE_DIR" ] || exit 0  # 아직 판정이 하나도 없으면 스킵

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/state-$(date +%Y%m%d-%H%M).tar.gz" -C "$PROJECT_DIR" .wrangler/state
find "$BACKUP_DIR" -name 'state-*.tar.gz' -mtime +30 -delete
