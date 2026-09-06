#!/usr/bin/env bash
# Tarik versi terbaru dari GitHub ke VPS.
# Jalankan di VPS: bash /opt/coc/deploy/update.sh
#
# Situs disajikan langsung dari direktori kerja git lewat bind mount read-only,
# jadi biasanya `git pull` saja sudah cukup — container tidak perlu disentuh.
# Pengecualiannya nginx.conf: ia dipasang sebagai bind mount berkas tunggal
# yang terikat inode, dan git menulis inode baru saat berkasnya berubah,
# sehingga container harus dibuat ulang agar membaca versi baru.
set -euo pipefail

SITUS="${SITUS:-/opt/coc}"
BRANCH="${BRANCH:-main}"

cd "$SITUS"

SEBELUM_CONF="$(git rev-parse HEAD:deploy/nginx.conf 2>/dev/null || echo none)"
SEBELUM_COMPOSE="$(git rev-parse HEAD:deploy/docker-compose.yml 2>/dev/null || echo none)"
SEBELUM_SERVER="$(git rev-parse HEAD:server 2>/dev/null || echo none)"

echo "==> Menarik perubahan terbaru di $SITUS (branch $BRANCH)"
git fetch --quiet origin "$BRANCH"
git reset --hard --quiet "origin/$BRANCH"

SESUDAH_CONF="$(git rev-parse HEAD:deploy/nginx.conf 2>/dev/null || echo none)"
SESUDAH_COMPOSE="$(git rev-parse HEAD:deploy/docker-compose.yml 2>/dev/null || echo none)"
SESUDAH_SERVER="$(git rev-parse HEAD:server 2>/dev/null || echo none)"

COMPOSE="docker compose -f $SITUS/deploy/docker-compose.yml"

if [ "$SEBELUM_SERVER" != "$SESUDAH_SERVER" ]; then
    echo "==> Kode API berubah — membangun ulang container API"
    $COMPOSE up -d --build coc-api
    # Situs statisnya tetap perlu diperiksa terpisah di bawah.
fi

if [ "$SEBELUM_COMPOSE" != "$SESUDAH_COMPOSE" ]; then
    echo "==> docker-compose.yml berubah — menerapkan ulang semuanya"
    $COMPOSE up -d
elif [ "$SEBELUM_CONF" != "$SESUDAH_CONF" ]; then
    echo "==> nginx.conf berubah — membuat ulang container situs"
    $COMPOSE up -d --force-recreate coc
elif [ "$SEBELUM_SERVER" = "$SESUDAH_SERVER" ]; then
    echo "==> Hanya berkas situs yang berubah — container tidak perlu disentuh"
fi

echo "==> Selesai. Versi aktif: $(git rev-parse --short HEAD)"
