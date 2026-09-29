#!/usr/bin/env bash
# Actualiza Rendi en el servidor: respaldo, última versión, instalación, build y reinicio.
# Lo corre un administrador (con sudo); los pasos del repo se ejecutan como el usuario `rendi`:
#   /opt/rendi/deploy/update.sh
# Al arrancar, la API aplica las migraciones pendientes (y antes guarda data/pre-migration-*.db).
set -euo pipefail
cd "$(dirname "$0")/.."

as_rendi() { sudo -u rendi "$@"; }

if [[ -f apps/api/data/rendi.db ]]; then
  as_rendi deploy/backup.sh
fi
as_rendi git pull --ff-only
as_rendi pnpm install --frozen-lockfile
as_rendi pnpm build
sudo systemctl restart rendi
sleep 2
systemctl --no-pager --lines=5 status rendi
