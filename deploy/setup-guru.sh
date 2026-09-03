#!/usr/bin/env bash
# Memasang frasa sandi dasbor guru, sekali saja.
#
# Jalankan di server dengan terminal sungguhan (perlu -t supaya bisa
# mengetik tanpa gema):
#
#   ssh -t root@SERVER 'bash /opt/coc/deploy/setup-guru.sh'
#
# Frasa sandinya tidak pernah ditulis ke berkas, ke riwayat shell, atau ke
# log: yang tersimpan di deploy/.env hanya garam dan hash scrypt-nya, dan
# dari situ frasa aslinya tidak bisa dikembalikan.
set -euo pipefail

SITUS="${SITUS:-/opt/coc}"
ENV_BERKAS="$SITUS/deploy/.env"

if [ ! -d "$SITUS" ]; then
    echo "Tidak menemukan $SITUS. Set SITUS=/jalur/lain kalau reponya di tempat lain." >&2
    exit 1
fi

if [ ! -t 0 ]; then
    cat >&2 <<PESAN
Perlu terminal sungguhan untuk mengetik frasa sandi tanpa gema.

Yang kamu pakai sekarang tidak menyediakannya. Prompt bash di dalam
Claude Code, pipa, dan cron semuanya begitu — di situ "ssh -t" pun tidak
menolong, karena yang kurang adalah terminal di sisi kamu, bukan di server.

Buka aplikasi Terminal sendiri (Terminal.app, iTerm, atau Windows
Terminal), lalu jalankan:

  ssh -t root@SERVER 'bash $SITUS/deploy/setup-guru.sh'
PESAN
    exit 1
fi

if [ -f "$ENV_BERKAS" ] && grep -q '^SANDI_GURU_SCRYPT=' "$ENV_BERKAS"; then
    echo "Frasa sandi guru sudah terpasang di $ENV_BERKAS."
    printf 'Ganti dengan yang baru? [y/N] '
    read -r jawab
    case "$jawab" in [yY]*) ;; *) echo "Dibatalkan."; exit 0 ;; esac
fi

echo
echo "Frasa sandi ini membuka data seluruh kelas, jadi pakai yang panjang."
echo "Minimal 12 karakter. Ketikanmu tidak akan terlihat."
echo

printf 'Frasa sandi        : '
read -rs SANDI; echo
printf 'Ulangi frasa sandi : '
read -rs SANDI2; echo
echo

if [ "$SANDI" != "$SANDI2" ]; then
    echo "Dua ketikan itu berbeda. Coba lagi." >&2
    exit 1
fi
if [ "${#SANDI}" -lt 12 ]; then
    echo "Terlalu pendek (${#SANDI} karakter). Minimal 12." >&2
    exit 1
fi

# Frasanya dioper lewat variabel lingkungan ke node, bukan lewat argumen
# baris perintah — argumen terlihat oleh siapa pun yang menjalankan `ps`.
HASH="$(SANDI_MASUK="$SANDI" node -e '
const c = require("node:crypto");
const s = c.randomBytes(16);
process.stdout.write(s.toString("hex") + ":" + c.scryptSync(process.env.SANDI_MASUK, s, 32).toString("hex"));
')"
unset SANDI SANDI2

umask 077
touch "$ENV_BERKAS"
chmod 600 "$ENV_BERKAS"
# Baris SANDI_GURU_SCRYPT lama dibuang, sisa berkasnya dibiarkan utuh.
if grep -q '^SANDI_GURU_SCRYPT=' "$ENV_BERKAS" 2>/dev/null; then
    grep -v '^SANDI_GURU_SCRYPT=' "$ENV_BERKAS" > "$ENV_BERKAS.tmp" || true
    mv "$ENV_BERKAS.tmp" "$ENV_BERKAS"
    chmod 600 "$ENV_BERKAS"
fi
echo "SANDI_GURU_SCRYPT=$HASH" >> "$ENV_BERKAS"

echo "==> Tersimpan di $ENV_BERKAS (izin 600, hanya root)"
echo "==> Menjalankan ulang container API"
docker compose -f "$SITUS/deploy/docker-compose.yml" up -d coc-api >/dev/null 2>&1

echo "==> Memeriksa"
for i in $(seq 1 10); do
    sleep 1
    if docker exec coc-api node -e '
      const h=require("node:http");
      h.get({host:"127.0.0.1",port:8080,path:"/api/sehat"},r=>{
        let b="";r.on("data",c=>b+=c);r.on("end",()=>{
          process.exit(JSON.parse(b).guru ? 0 : 1);
        });
      }).on("error",()=>process.exit(1));
    ' 2>/dev/null; then
        echo
        echo "Beres. Dasbor guru sudah terbuka."
        echo "Buka https://coc.balanglompo.com/guru dan masuk dengan frasa sandi tadi."
        exit 0
    fi
done

echo "API belum melaporkan siap. Periksa: docker logs coc-api --tail 20" >&2
exit 1
