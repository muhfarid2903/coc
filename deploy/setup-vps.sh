#!/usr/bin/env bash
#
# Pemasangan sekali jalan untuk COC di VPS Ubuntu/Debian.
#
#   sudo bash setup-vps.sh                          sajikan lewat alamat IP
#   sudo bash setup-vps.sh contoh.com               pakai domain + HTTPS
#   sudo bash setup-vps.sh contoh.com kamu@mail.com domain + HTTPS + email pengingat
#
# Aman dijalankan berulang: pemanggilan berikutnya hanya memperbarui kode.
#
set -euo pipefail

REPO="https://github.com/muhfarid2903/coc.git"
SITUS="/var/www/coc"
DOMAIN="${1:-}"
EMAIL="${2:-}"

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo atau sebagai root." >&2; exit 1; }

echo "==> 1/5 Memasang paket yang dibutuhkan"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx git
[ -n "$DOMAIN" ] && apt-get install -y -qq certbot python3-certbot-nginx

echo "==> 2/5 Mengambil kode ke $SITUS"
if [ -d "$SITUS/.git" ]; then
  git -C "$SITUS" fetch --quiet origin main
  git -C "$SITUS" reset --hard --quiet origin/main
else
  rm -rf "$SITUS"
  git clone --quiet --depth 1 "$REPO" "$SITUS"
fi
chown -R www-data:www-data "$SITUS"

echo "==> 3/5 Menyiapkan konfigurasi Nginx"
CONF=/etc/nginx/sites-available/coc
cp "$SITUS/deploy/nginx.conf" "$CONF"

if [ -n "$DOMAIN" ]; then
  sed -i "s/contoh\.com/$DOMAIN/g" "$CONF"
else
  # Tanpa domain: jadikan situs bawaan agar dapat dibuka lewat alamat IP.
  sed -i 's/^\( *\)server_name .*/\1server_name _;/' "$CONF"
  sed -i 's/^\( *\)listen 80;/\1listen 80 default_server;/' "$CONF"
  sed -i 's/^\( *\)listen \[::\]:80;/\1listen [::]:80 default_server;/' "$CONF"
  rm -f /etc/nginx/sites-enabled/default
fi

# Server tanpa IPv6 akan menolak baris listen [::] — buang bila tidak didukung.
[ -f /proc/net/if_inet6 ] || sed -i '/listen \[::\]/d' "$CONF"

ln -sfn "$CONF" /etc/nginx/sites-enabled/coc

echo "==> 4/5 Menguji lalu memuat ulang Nginx"
nginx -t
systemctl reload nginx

if [ -n "$DOMAIN" ]; then
  echo "==> 5/5 Menyiapkan HTTPS lewat Let's Encrypt"
  if [ -n "$EMAIL" ]; then DAFTAR=(-m "$EMAIL"); else DAFTAR=(--register-unsafely-without-email); fi
  if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" \
       --non-interactive --agree-tos --redirect "${DAFTAR[@]}"; then
    echo
    echo "Selesai. Situs aktif di https://$DOMAIN"
  else
    echo
    echo "Certbot gagal — biasanya karena DNS belum mengarah ke server ini." >&2
    echo "Pastikan data A untuk $DOMAIN dan www.$DOMAIN menunjuk IP server," >&2
    echo "lalu ulangi perintah yang sama." >&2
    echo "Sementara itu situs tetap dapat dibuka di http://$DOMAIN" >&2
  fi
else
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "==> 5/5 Selesai"
  echo
  echo "Situs aktif di http://${IP:-alamat-IP-server-ini}"
  echo "Untuk memasang domain dan HTTPS, ulangi dengan: sudo bash setup-vps.sh domainmu.com"
fi
