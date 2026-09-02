#!/usr/bin/env node
/* Membuat nilai SANDI_GURU_SCRYPT untuk deploy/.env.

   Frasa sandinya diketik di sini dan tidak pernah ikut tersimpan: yang
   dicetak hanya garam dan hash-nya. Jalankan di mesinmu sendiri, lalu
   salin satu baris hasilnya ke deploy/.env di server.

     node server/hash-passphrase.js
*/
'use strict';

const crypto = require('node:crypto');
const readline = require('node:readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

rl.question('Frasa sandi guru (minimal 12 karakter): ', (frasa) => {
  rl.close();
  const f = String(frasa || '').trim();
  if (f.length < 12) {
    console.error('\nTerlalu pendek. Dasbor guru memegang data seluruh kelas — pakai minimal 12 karakter.');
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(f, salt, 32);
  console.log('\nSalin baris ini ke deploy/.env di server:\n');
  console.log('SANDI_GURU_SCRYPT=' + salt.toString('hex') + ':' + key.toString('hex'));
});
