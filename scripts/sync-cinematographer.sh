#!/usr/bin/env bash
# Génère la version « Cinematography seule » et la pousse sur moodpics/sebtran-CinematographerOnly (sebastien-tran.com).
# À lancer depuis la racine de sebtran, une fois les modifs poussées.
set -euo pipefail
TARGET_DIR="${1:-../sebtran-cinematographeronly}"
REPO="https://github.com/moodpics/sebtran-CinematographerOnly"
SRC_SHA=$(git rev-parse --short HEAD)
[ -d "$TARGET_DIR/.git" ] || git clone --depth 1 "$REPO" "$TARGET_DIR"
git -C "$TARGET_DIR" pull -q --ff-only || true
TMP=$(mktemp -d)
node scripts/build-cinematographer.mjs "$TMP"
find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$TMP"/. "$TARGET_DIR"/
cd "$TARGET_DIR"
git add -A
if git diff --cached --quiet; then echo "Rien à synchroniser."; else
  git commit -q -m "Sync depuis moodpics/sebtran@$SRC_SHA"
  git -c push.negotiate=true push origin HEAD
fi
