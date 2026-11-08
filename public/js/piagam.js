/**
 * Piagam Komitmen Bersama Zona Integritas - BBPOM di Pangkalpinang
 * Real-time Dashboard & Socket.IO Client
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const totalCountEl = document.getElementById('totalSignatureCount');
  const pegawaiCountEl = document.getElementById('pegawaiCount');
  const kepalaCard = document.getElementById('leaderKepalaCard');
  const kabagTuCard = document.getElementById('leaderKabagTuCard');
  const employeesGrid = document.getElementById('employeesGrid');
  const toastContainer = document.getElementById('toastContainer');

  // Action buttons
  const btnPrint = document.getElementById('btnPrintCharter');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  const btnFullscreen = document.getElementById('btnToggleFullscreen');
  const charterSheet = document.getElementById('charterSheet');
  const btnQrModal = document.getElementById('btnShowQrModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const qrModal = document.getElementById('qrModal');
  const qrImageEl = document.getElementById('modalQrImage');
  const qrUrlText = document.getElementById('modalQrUrl');
  const btnCopyUrl = document.getElementById('btnCopyUrl');

  // Audio tone generator (Web Audio API)
  let audioCtx = null;
  function playNotificationChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      // Pleasant dual chime
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      // Audio autoplay policy might restrict without prior click
    }
  }

  // 1. Toast Notification for new participant signature
  function showToast(name, role, isLeader = false) {
    playNotificationChime();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="toast-content">
        <div class="toast-title">${isLeader ? '🌟 PIMPINAN MENANDATANGANI' : '✅ TANDA TANGAN BARU'}</div>
        <div class="toast-name">${escapeHtml(name)}</div>
        <div class="toast-role">${escapeHtml(role)}</div>
      </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 2. Render Leader Cards (Kepala & Kabag TU)
  function renderLeader(element, data, defaultTitle, defaultSub) {
    if (data && data.signatureDataUrl) {
      element.classList.add('signed');
      element.innerHTML = `
        <div class="leader-badge-role">${escapeHtml(defaultTitle)}</div>
        <div class="leader-sig-box">
          <img src="${data.signatureDataUrl}" class="leader-sig-img" alt="Tanda Tangan ${escapeHtml(data.name)}">
        </div>
        <div class="leader-name">${escapeHtml(data.name)}</div>
        <div class="leader-nip">NIP. ${escapeHtml(data.nip)}</div>
        <!-- <div class="leader-signed-time">✓ Ditandatangani ${data.timestampFormatted ? 'pukul ' + data.timestampFormatted : ''}</div> -->
      `;
    } else {
      element.classList.remove('signed');
      element.innerHTML = `
        <div class="leader-badge-role">${escapeHtml(defaultTitle)}</div>
        <div class="leader-sig-box">
          <div class="sig-placeholder-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>Menunggu Tanda Tangan</span>
          </div>
        </div>
        <div class="leader-name" style="text-decoration: none; color: #94a3b8; font-weight: normal;">( ................................................................ )</div>
        <div class="leader-nip">NIP. ........................................................</div>
      `;
    }
  }

  // 3. Render Employee Grid
  function updateGridDensity(count) {
    employeesGrid.classList.remove('density-compact', 'density-dense', 'density-micro');
    if (count > 48) {
      employeesGrid.classList.add('density-micro');
    } else if (count > 24) {
      employeesGrid.classList.add('density-dense');
    } else if (count > 12) {
      employeesGrid.classList.add('density-compact');
    }
  }

  function renderEmployees(pegawaiList, newId = null) {
    if (!pegawaiList || pegawaiList.length === 0) {
      employeesGrid.classList.remove('density-compact', 'density-dense', 'density-micro');
      employeesGrid.innerHTML = `
        <div class="empty-employees-placeholder">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <div style="font-weight: 700; font-size: 1.05rem; margin-bottom: 4px; color: #002147;">Belum Ada Tanda Tangan Pegawai</div>
          <div style="font-size: 0.85rem;">Pindai QR Code di layar untuk membubuhkan tanda tangan komitmen Anda secara langsung.</div>
        </div>
      `;
      return;
    }

    updateGridDensity(pegawaiList.length);
    employeesGrid.innerHTML = '';
    pegawaiList.forEach((emp, index) => {
      const card = document.createElement('div');
      card.className = 'employee-card';
      if (newId && emp.id === newId) {
        card.classList.add('new-entry-highlight');
      }

      card.innerHTML = `
        <span class="emp-seq-badge">#${index + 1}</span>
        <div class="emp-sig-box">
          <img src="${emp.signatureDataUrl}" class="emp-sig-img" alt="TTD ${escapeHtml(emp.name)}" loading="lazy">
        </div>
        <div class="emp-name" title="${escapeHtml(emp.name)}">${escapeHtml(emp.name)}</div>
        <div class="emp-nip">NIP. ${escapeHtml(emp.nip)}</div>
        <div class="emp-jabatan" title="${escapeHtml(emp.jabatan)}">${escapeHtml(emp.jabatan)}</div>
      `;
      employeesGrid.appendChild(card);
    });
  }

  // 4. Update Header Counter Stats
  function updateCounters(meta) {
    if (!meta) return;
    totalCountEl.textContent = meta.total || 0;
    if (pegawaiCountEl) {
      pegawaiCountEl.textContent = meta.pegawaiCount || 0;
    }
  }

  // 5. Connect to Socket.IO
  const socket = io();

  socket.on('connect', () => {
    console.log('Tersambung ke server real-time Socket.IO.');
  });

  socket.on('initial_data', (payload) => {
    renderLeader(kepalaCard, payload.kepala, 'KEPALA BALAI BESAR POM DI PANGKAL PINANG');
    renderLeader(kabagTuCard, payload.kabag_tu, 'KABAG TATA USAHA BALAI BESAR POM DI PANGKAL PINANG');
    renderEmployees(payload.pegawai);
    updateCounters(payload.meta);
  });

  socket.on('new_signature', (payload) => {
    const { record, state, meta } = payload;
    const isLeader = record.roleType === 'KEPALA' || record.roleType === 'KABAG_TU';

    // Show toast
    showToast(record.name, record.jabatan, isLeader);

    // Update views
    renderLeader(kepalaCard, state.kepala, 'KEPALA BALAI BESAR POM DI PANGKAL PINANG');
    renderLeader(kabagTuCard, state.kabag_tu, 'KABAG TATA USAHA BALAI BESAR POM DI PANGKAL PINANG');
    renderEmployees(state.pegawai, record.id);
    updateCounters(meta);
  });

  socket.on('signature_deleted', (payload) => {
    renderLeader(kepalaCard, payload.state.kepala, 'KEPALA BALAI BESAR POM DI PANGKAL PINANG');
    renderLeader(kabagTuCard, payload.state.kabag_tu, 'KABAG TATA USAHA BALAI BESAR POM DI PANGKAL PINANG');
    renderEmployees(payload.state.pegawai);
    updateCounters({
      total: (payload.state.kepala ? 1 : 0) + (payload.state.kabag_tu ? 1 : 0) + payload.state.pegawai.length,
      pegawaiCount: payload.state.pegawai.length
    });
  });

  socket.on('data_reset', () => {
    renderLeader(kepalaCard, null, 'KEPALA BALAI BESAR POM DI PANGKAL PINANG');
    renderLeader(kabagTuCard, null, 'KABAG TATA USAHA BALAI BESAR POM DI PANGKAL PINANG');
    renderEmployees([]);
    updateCounters({ total: 0, pegawaiCount: 0 });
  });

  // 6. Action Bar Controls: Download PDF A3 & Print
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', async () => {
      if (typeof window.html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Modul PDF sedang diinisialisasi. Silakan klik kembali dalam beberapa detik.');
        return;
      }

      const origBtnHtml = btnDownloadPdf.innerHTML;
      btnDownloadPdf.disabled = true;
      btnDownloadPdf.innerHTML = `
        <span class="spinner" style="width: 15px; height: 15px; border-width: 2px;"></span>
        <span>Membuat PDF A3 (1 Halaman)...</span>
      `;

      try {
        window.scrollTo(0, 0);

        // Create isolated render sandbox at exact (0, 0) to avoid any viewport/flexbox offset
        const sandbox = document.createElement('div');
        sandbox.id = 'pdfExportSandbox';
        sandbox.style.cssText = 'position:fixed;left:0;top:0;width:1588px;height:1123px;z-index:999999;overflow:hidden;background:#fdfcf7;margin:0;padding:0;';

        // Deep clone charterSheet
        const clone = charterSheet.cloneNode(true);
        clone.classList.add('a3-export-mode');
        clone.style.cssText = 'width:1588px!important;height:1123px!important;position:absolute;left:0;top:0;margin:0!important;box-sizing:border-box!important;';

        sandbox.appendChild(clone);
        document.body.appendChild(sandbox);

        // Wait for fonts and images paint
        await new Promise(resolve => setTimeout(resolve, 150));

        // Capture clone at exact coordinates (0, 0)
        const canvas = await html2canvas(clone, {
          scale: 2, // 3176 x 2246 ultra-HD
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#fdfcf7',
          logging: false,
          width: 1588,
          height: 1123,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0
        });

        // Remove sandbox immediately
        document.body.removeChild(sandbox);

        const imgData = canvas.toDataURL('image/jpeg', 0.96);

        // Instantiate jsPDF for strict A3 Landscape (420mm x 297mm)
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a3',
          compress: true
        });

        // Fill 100% of the A3 Landscape page (420mm x 297mm) edge-to-edge
        // Perfectly symmetrical: 0mm wasted space on left, right, top, or bottom!
        pdf.addImage(imgData, 'JPEG', 0, 0, 420, 297, undefined, 'FAST');

        // File download with clear naming
        pdf.save('Piagam_Pencanangan_Zona_Integritas_BBPOM_Pangkalpinang_A3.pdf');

        showToast('PDF A3 Berhasil Diunduh', 'Format Penuh A3 Landscape 1 Halaman');
      } catch (err) {
        const existingSandbox = document.getElementById('pdfExportSandbox');
        if (existingSandbox) {
          existingSandbox.remove();
        }
        console.error('Error generating A3 PDF:', err);
        alert('Gagal membuat file PDF: ' + err.message);
      } finally {
        btnDownloadPdf.disabled = false;
        btnDownloadPdf.innerHTML = origBtnHtml;
      }
    });
  }

  btnPrint.addEventListener('click', () => {
    window.print();
  });

  // Fullscreen UI Synchronizer (syncs button and body class with native fullscreen state)
  function syncFullscreenState() {
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (isFull) {
      document.body.classList.add('is-fullscreen');
      btnFullscreen.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
        <span>Keluar Layar Penuh</span>
      `;
    } else {
      document.body.classList.remove('is-fullscreen');
      btnFullscreen.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        <span>Layar Penuh</span>
      `;
    }
  }

  document.addEventListener('fullscreenchange', syncFullscreenState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenState);

  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => {
          alert(`Error mengaktifkan layar penuh: ${err.message}`);
        });
      } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  });

  // 7. QR Code Modal Handlers
  let cachedSignUrl = '';
  async function loadQrInfo() {
    try {
      const res = await fetch('/api/info');
      const info = await res.json();
      cachedSignUrl = info.mobileSignUrl;
      qrUrlText.textContent = info.mobileSignUrl;
      qrImageEl.src = `/api/qr-image?url=${encodeURIComponent(info.mobileSignUrl)}`;
    } catch (e) {
      console.error('Failed to load QR info:', e);
      qrUrlText.textContent = `${window.location.origin}/sign`;
      qrImageEl.src = `/api/qr-image?url=${encodeURIComponent(window.location.origin + '/sign')}`;
    }
  }

  btnQrModal.addEventListener('click', () => {
    loadQrInfo();
    qrModal.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    qrModal.classList.remove('active');
  });

  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      qrModal.classList.remove('active');
    }
  });

  btnCopyUrl.addEventListener('click', () => {
    navigator.clipboard.writeText(cachedSignUrl || qrUrlText.textContent).then(() => {
      const originalText = btnCopyUrl.innerHTML;
      btnCopyUrl.innerHTML = `✓ Tersalin!`;
      setTimeout(() => {
        btnCopyUrl.innerHTML = originalText;
      }, 2000);
    });
  });

  // 8. Admin / Demo Tools Handlers
  const btnAdminTools = document.getElementById('btnAdminTools');
  const adminModal = document.getElementById('adminModal');
  const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
  const btnSeedDemo = document.getElementById('btnSeedDemo');
  const btnResetAll = document.getElementById('btnResetAll');

  if (btnAdminTools && adminModal) {
    btnAdminTools.addEventListener('click', () => {
      adminModal.classList.add('active');
    });

    btnCloseAdminModal.addEventListener('click', () => {
      adminModal.classList.remove('active');
    });

    adminModal.addEventListener('click', (e) => {
      if (e.target === adminModal) {
        adminModal.classList.remove('active');
      }
    });

    btnSeedDemo.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/seed', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          adminModal.classList.remove('active');
          showToast('Data Simulasi Berhasil Dimuat', '6 Tanda Tangan Contoh');
        }
      } catch (err) {
        alert('Gagal memuat data simulasi');
      }
    });

    btnResetAll.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA tanda tangan untuk memulai piagam baru yang bersih?')) {
        try {
          const res = await fetch('/api/reset', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            adminModal.classList.remove('active');
            showToast('Piagam Telah Direset', 'Kesiapan Acara Bersih');
          }
        } catch (err) {
          alert('Gagal mereset data');
        }
      }
    });
  }

  // Load QR info once in background
  loadQrInfo();
});
