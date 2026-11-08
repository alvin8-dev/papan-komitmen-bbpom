# Papan Komitmen Pencanangan Zona Integritas (WBK & WBBM)
## Balai Besar Pengawas Obat dan Makanan (BBPOM) di Pangkalpinang

Aplikasi web full-stack resmi untuk acara Pencanangan Zona Integritas Wilayah Birokrasi Bersih dan Melayani (WBBM) Balai Besar POM di Pangkal Pinang tanggal 20 November 2026.

---

### Fitur Utama

1. **Halaman Piagam / Dashboard Layar Besar (`/`)**
   - Template piagam resmi dengan nuansa khas instansi Badan POM (Navy `#002147`, Gold `#C59B27`, dan aksen Green `#008542`).
   - Logo resmi Badan POM, Lambang Garuda Pancasila, dan Badge Zona Integritas (WBK - WBBM).
   - Teks deklarasi resmi komitmen bersama.
   - **Aturan Posisi Khusus Pimpinan:**
     - Tanda tangan **Kepala Balai Besar POM di Pangkal Pinang** tetap berada di posisi **kiri atas**.
     - Tanda tangan **Kabag TU Balai Besar POM di Pangkal Pinang** tetap berada di posisi **sebelah kanan** Kepala Balai.
   - Grid tanda tangan segenap pegawai yang tersusun rapi.
   - **Update Real-time:** Setiap ada peserta yang mengirim tanda tangan, data langsung muncul secara instan di layar tanpa perlu refresh menggunakan WebSocket (Socket.IO) disertai animasi sorotan (*glow effect*) dan notifikasi (*toast & chime*).
   - **Format Cetak A3 Landscape:** Siap dicetak langsung dengan tombol *Cetak Piagam (A3)* menggunakan styling `@media print` presisi standar dokumen kenegaraan.

2. **Halaman Input Peserta Mobile-Friendly (`/sign`)**
   - Dioptimalkan khusus untuk layar smartphone dan tablet.
   - Input Nama Lengkap beserta gelar.
   - Input NIP.
   - Pilihan jabatan otomatis (Kepala Balai, Kabag TU, Ketua Tim Kerja, Pejabat Fungsional, Staf, maupun opsi ketik manual).
   - Canvas Signature Pad responsif dengan dukungan layar sentuh (touchscreen) dan mouse, pemilihan warna tinta (Navy BPOM, Hitam Resmi, Biru Pena), tombol Undo goresan, dan Hapus.
   - Lembar persetujuan komitmen.
   - Layar konfirmasi sukses dengan kartu preview hasil tanda tangan dan tombol untuk menandatangani peserta berikutnya.

3. **Akses Cepat Barcode / QR Code (`/qr`)**
   - QR Code dinamis beresolusi tinggi yang langsung mengarahkan kamera smartphone peserta ke form input `/sign`.
   - Otomatis mendeteksi IP jaringan lokal (Wi-Fi) acara (`http://192.168.1.12:3000/sign`) sehingga seluruh peserta di ruangan aula dapat langsung memindai tanpa konfigurasi manual.
   - Tersedia tombol modal popup QR di dashboard utama dan halaman layar penuh terpisah `/qr` untuk proyektor.

4. **Backend & REST API**
   - Node.js + Express + Socket.IO.
   - Penyimpanan data persisten berbasis file JSON sederhana (`data/signatures.json`).
   - `GET /api/signatures` : Mengambil daftar seluruh tanda tangan dan metadata.
   - `POST /api/signatures` : Menerima submit data peserta dan memancarkan event Socket.IO `new_signature`.
   - `GET /api/info` : Informasi IP dan URL akses perangkat bergerak.
   - `GET /api/qr-image` : Menghasilkan gambar QR Code resolusi tinggi.
   - `POST /api/seed` : Muat data simulasi / gladi bersih.
   - `POST /api/reset` : Reset piagam menjadi bersih untuk acara resmi.

---

### Panduan Menjalankan Dev Server

1. **Jalankan Server:**
   ```bash
   node server.js
   ```
2. **Akses Dashboard Utama (Layar Besar / TV Hall):**
   ```
   http://localhost:3000
   ```
3. **Akses Form Input Peserta (Handphone / Tablet):**
   ```
   http://localhost:3000/sign
   # Atau via Wi-Fi lokal peserta:
   http://192.168.1.12:3000/sign
   ```
4. **Tampilan QR Code Proyektor:**
   ```
   http://localhost:3000/qr
   ```

