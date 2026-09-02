#!/usr/bin/env bash
# Tarik versi terbaru dari GitHub ke VPS lalu muat ulang Nginx.
# Jalankan di VPS: sudo bash /var/www/coc/deploy/update.sh
set -euo pipefail

SITUS="${SITUS:-/var/www/coc}"
BRANCH="${BRANCH:-main}"

echo "==> Menarik perubahan terbaru di $SITUS (branch $BRANCH)"
git -C "$SITUS" fetch --quiet origin "$BRANCH"
git -C "$SITUS" reset --hard "origin/$BRANCH"

echo "==> Merapikan hak akses"
chown -R www-data:www-data "$SITUS"

echo "==> Menguji konfigurasi Nginx"
nginx -t

echo "==> Memuat ulang Nginx"
systemctl reload nginx

echo "==> Selesai. Versi aktif: $(git -C "$SITUS" rev-parse --short HEAD)"
