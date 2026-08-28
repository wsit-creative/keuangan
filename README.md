# Arus Kas WSIT — HTML/CSS/JS + Google Spreadsheet

Website ini menyediakan:
- Pemasukan: jumlah, keterangan, tanggal
- Pengeluaran: jumlah, keterangan, tanggal
- Sisa saldo
- Rekap pemasukan/pengeluaran per bulan
- Rekap pemasukan/pengeluaran per hari
- Grafik harian dan bulanan
- Edit & hapus transaksi
- Export CSV
- Mode lokal (localStorage) sebelum database dihubungkan
- Database Google Spreadsheet melalui Google Apps Script

## 1. Siapkan Spreadsheet

Buat Google Spreadsheet baru, misalnya `Arus Kas WSIT`.

Tidak perlu membuat kolom secara manual karena Apps Script akan membuat sheet `Transaksi` otomatis.

## 2. Pasang Apps Script

Di Google Spreadsheet:
1. Buka `Ekstensi` → `Apps Script`.
2. Hapus kode contoh.
3. Buka file `Code.gs` dari paket ini, copy semua isinya ke Apps Script.
4. Klik `Deploy` → `New deployment`.
5. Pilih tipe `Web app`.
6. Execute as: `Me`.
7. Who has access: `Anyone`.
8. Deploy dan salin URL `/exec`.

Jika Google meminta otorisasi, izinkan akses ke spreadsheet.

## 3. Hubungkan website

Buka `index.html`.
Masuk ke menu `Pengaturan`.
Tempel URL Web App Apps Script ke kolom URL database.
Klik `Simpan & Tes Koneksi`.

Setelah terhubung, transaksi yang ditambah/edit/hapus akan disinkronkan ke spreadsheet.

## 4. Struktur data

Sheet `Transaksi`:
ID | Tipe | Jumlah | Keterangan | Tanggal | Dibuat

Contoh:
TRX-123 | income | 340000 | Saldo WSIT | 2025-10-17 | 2025-10-17T...
TRX-124 | expense | 25625 | natur-E vitamin | 2025-10-17 | 2025-10-17T...

## 5. Catatan saldo

`Saldo awal` disimpan di browser yang digunakan. Sisa saldo dihitung:
Saldo Awal + seluruh pemasukan - seluruh pengeluaran.

Kalau ingin saldo awal juga disimpan di spreadsheet agar bisa dibuka dari perangkat lain, struktur Apps Script bisa dikembangkan dengan sheet `Pengaturan`.

## 6. Menjalankan

Untuk pemakaian sederhana:
- buka `index.html` di browser, atau
- upload folder ini ke hosting statis seperti GitHub Pages / Netlify / Vercel.

Chart.js dimuat dari CDN, jadi koneksi internet diperlukan untuk grafik.

## 7. Migrasi data lama

Jika data lama dari tabel pada screenshot ingin dimasukkan, data tersebut dapat dipindahkan ke sheet `Transaksi` dengan mapping:
- Pemasukan → Tipe `income`
- Pengeluaran → Tipe `expense`
- Keterangan pemasukan/pengeluaran → Keterangan
- Tgl masuk/tgl keluar → Tanggal
- Nominal → Jumlah

Sebaiknya data lama dibersihkan dulu supaya setiap transaksi hanya mempunyai satu baris.
