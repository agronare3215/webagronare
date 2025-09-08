#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Creando carpetas de archive..."
mkdir -p archive/backups archive/patches

# Mover .bak y .bak2
shopt -s nullglob
BAKS=( *.bak *.bak2 )
PATCHES=( *.patch )

if [ ${#BAKS[@]} -gt 0 ]; then
  echo "==> Moviendo archivos .bak a archive/backups/ ..."
  for f in "${BAKS[@]}"; do
    git mv -f "$f" archive/backups/ 2>/dev/null || mv -f "$f" archive/backups/
  done
else
  echo "==> No se encontraron .bak"
fi

if [ ${#PATCHES[@]} -gt 0 ]; then
  echo "==> Moviendo archivos .patch a archive/patches/ ..."
  for f in "${PATCHES[@]}"; do
    git mv -f "$f" archive/patches/ 2>/dev/null || mv -f "$f" archive/patches/
  done
else
  echo "==> No se encontraron .patch"
fi

echo "==> Asegurando cambios con git (si repo git disponible)..."
if git rev-parse --git-dir > /dev/null 2>&1; then
  git add -A
  git commit -m "archive: mover .bak y .patch a archive/ (script automático)" || echo "==> No hay cambios para commitear."
  echo "==> Commit creado (si hubo cambios)."
else
  echo "==> No parece ser un repo git. Los archivos fueron movidos pero no hay commit."
fi

echo "==> Listado de archive/"
ls -la archive
echo "==> Hecho."
