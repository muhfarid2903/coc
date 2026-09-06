# Node 24 dipilih karena `node:sqlite` sudah tersedia sebagai modul bawaan,
# jadi tidak ada modul native yang perlu dikompilasi dan image tetap kecil.
# API ini memang nol dependensi — tidak ada `npm install` sama sekali.
FROM node:24-alpine

WORKDIR /app

# Tanpa tzdata, Alpine mengabaikan env TZ dan cap waktu log tetap UTC,
# sehingga jam di log tidak cocok dengan jam sekolah.
RUN apk add --no-cache tzdata

COPY . .

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/coc.db

# Berkas SQLite hidup di volume, bukan di dalam image.
VOLUME ["/data"]
EXPOSE 8080

CMD ["node", "server.js"]
