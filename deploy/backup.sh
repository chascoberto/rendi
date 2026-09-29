#!/usr/bin/env bash
# Respaldo en caliente de la base de Rendi con `sqlite3 .backup` (seguro con WAL; nunca `cp`).
# Verifica la copia, la comprime y conserva las últimas RENDI_BACKUP_KEEP (14 por defecto).
#
#   deploy/backup.sh                     # usa los valores por defecto
#   RENDI_DB=/ruta/rendi.db RENDI_BACKUP_DIR=/ruta/respaldos deploy/backup.sh
#
# Requiere el paquete `sqlite3`. Ver deploy/crontab.example para programarlo.
set -euo pipefail

DB="${RENDI_DB:-/opt/rendi/apps/api/data/rendi.db}"
DEST="${RENDI_BACKUP_DIR:-/var/backups/rendi}"
KEEP="${RENDI_BACKUP_KEEP:-14}"

if [[ ! -f "$DB" ]]; then
  echo "No existe la base: $DB" >&2
  exit 1
fi
mkdir -p "$DEST"

stamp="$(date +%Y%m%d-%H%M%S)"
target="$DEST/rendi-$stamp.db"

sqlite3 "$DB" ".timeout 10000" ".backup '$target'"
check="$(sqlite3 "$target" 'PRAGMA integrity_check;')"
if [[ "$check" != "ok" ]]; then
  echo "La copia $target no pasó integrity_check: $check" >&2
  rm -f "$target"
  exit 1
fi
gzip -9 "$target"

# Rotación: se conservan las KEEP copias más recientes.
ls -1t "$DEST"/rendi-*.db.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "Respaldo listo: $target.gz ($(du -h "$target.gz" | cut -f1))"
