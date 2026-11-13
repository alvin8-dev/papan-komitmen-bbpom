# Papan Komitmen Pencanangan Zona Integritas (WBK & WBBM)
## Balai Besar Pengawas Obat dan Makanan (BBPOM) di Pangkalpinang

Aplikasi web full-stack resmi untuk acara Pencanangan Zona Integritas Wilayah Birokrasi Bersih dan Melayani (WBBM) Balai Besar POM di Pangkal Pinang.

---

### Fitur Utama

1. **Dashboard Piagam Layar Besar (`/`)**
   - Tampilan piagam resmi berstandar instansi Badan POM (Navy `#002147`, Gold `#C59B27`, Green `#008542`).
   - Teks deklarasi resmi komitmen bersama.
   - **Tata Letak Khusus Pimpinan:**
     - Posisi Kiri Atas: **Kepala Balai Besar POM di Pangkal Pinang** (*Alex Sander, S.Farm., Apt., M.H*).
     - Posisi Kanan Atas: **Kabag Tata Usaha Balai Besar POM di Pangkal Pinang** (*Mardianto, S.Farm., Apt.*).
   - **Real-Time Update (Socket.IO):** Setiap kali ada peserta yang menandatangani, tanda tangan langsung muncul di layar proyektor tanpa perlu refresh.
   - **Download PDF A3 (1 Halaman):** Export ke format PDF A3 Landscape presisi 1 halaman penuh (420mm x 297mm) tanpa terpotong.
   - **Mode Layar Penuh (Fullscreen):** Tampilan bersih tanpa navigasi browser untuk layar proyektor aula acara.

2. **Halaman Input Peserta Mobile-Friendly (`/sign`)**
   - **Daftar Nominatif Pegawai:** 55 pegawai BBPOM di Pangkalpinang dapat langsung dipilih dari *dropdown*.
   - **Otomatisasi Pimpinan:** NIP dan Jabatan Kepala Balai dan Kabag TU terisi dan terkunci otomatis.
   - **Proses Cepat Staf:** Pegawai cukup memilih nama dan langsung membubuhkan tanda tangan.
   - **Canvas Signature Pad:** Menggambar halus dengan mouse/touchscreen, menghasilkan vektor SVG bergaris tegas tajam resolusi tinggi.

3. **Barcode / QR Code Dinamis (`/qr`)**
   - Menghasilkan QR Code dinamis resolusi tinggi yang mengarah ke link `/sign`.
   - Otomatis mendeteksi IP jaringan Wi-Fi lokal laptop server secara *real-time*.

4. **Alat Administrasi & Simulasi (`/api`)**
   - Simpan data berbasis JSON (`data/signatures.json`).
   - Fitur muat data simulasi contoh (*demo seed*).
   - Fitur reset bersih untuk persiapan hari-H acara.

---

### Cara Menjalankan di Komputer / Laptop

1. **Clone repository:**
   ```bash
   git clone <URL_REPOSITORY_ANDA>
   cd "Papan Komitmen"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Jalankan server:**
   - **Melalui Terminal:**
     ```bash
     npm start
     # atau: node server.js
     ```
   - **Di macOS:** Anda juga cukup klik 2x file `Jalankan_Server.command` di Finder.

4. **Akses Halaman:**
   - **Dashboard Piagam (Laptop/Proyektor):** `http://localhost:3000`
   - **Input Tanda Tangan (HP Peserta):** `http://<IP_LAPTOP>:3000/sign` atau `http://Alvindras-MacBook-Air.local:3000/sign`
   - **Layar Barcode QR:** `http://localhost:3000/qr`

---

### Cara Deploy ke Cloud (Online)

Jika ingin diakses melalui internet (misal menggunakan domain publik):
- Aplikasi ini siap di-deploy langsung ke platform seperti **Render**, **Railway**, atau **VPS (Ubuntu/Nginx)**.
- Port default dikonfigurasi melalui `process.env.PORT || 3000`.


