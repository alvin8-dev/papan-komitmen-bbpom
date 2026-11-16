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

  const DEFAULT_KEPALA_NAME = 'Alex Sander, S.Farm., Apt., M.H';
  const DEFAULT_KEPALA_NIP = '19791212 200604 1 005';
  const DEFAULT_KABAG_NAME = 'Mardianto, S.Farm., Apt.';
  const DEFAULT_KABAG_NIP = '19830326 200812 1 001';
  const leadershipGrid = document.getElementById('leadershipGrid');

  // 2. Render Leader Cards (Kepala & Kabag TU)
  function renderLeader(element, data, defaultTitle, expectedName = '', expectedNip = '') {
    if (!element) return;
    if (data && data.signatureDataUrl) {
      element.classList.add('signed');
      element.innerHTML = `
        <div class="leader-badge-role">${escapeHtml(defaultTitle)}</div>
        <div class="leader-sig-box">
          <img src="${data.signatureDataUrl}" class="leader-sig-img" alt="Tanda Tangan ${escapeHtml(data.name)}">
        </div>
        <div class="leader-name">${escapeHtml(data.name)}</div>
        <div class="leader-name-divider"></div>
        <div class="leader-nip">${data.nip && data.nip !== '-' ? 'NIP. ' + escapeHtml(data.nip) : '-'}</div>
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
        <div class="leader-name">${expectedName ? escapeHtml(expectedName) : '( ................................................................ )'}</div>
        <div class="leader-name-divider"></div>
        <div class="leader-nip">${expectedNip ? 'NIP. ' + escapeHtml(expectedNip) : 'NIP. ........................................................'}</div>
      `;
    }
  }

  // Render Pimpinan & Para Saksi dynamically in 1 baris yang sama
  function renderLeadershipAndWitnesses(kepala, kabag_tu, saksiList = []) {
    const grid = leadershipGrid || document.getElementById('leadershipGrid');
    if (!grid) return;

    const list = Array.isArray(saksiList) ? saksiList : [];
    const totalCards = 2 + list.length;

    // Apply dynamic density classes so cards fit seamlessly in 1 single row
    grid.classList.remove('leaders-dense-4', 'leaders-dense-7', 'leaders-dense-12');
    if (totalCards >= 8) {
      grid.classList.add('leaders-dense-12');
    } else if (totalCards >= 5) {
      grid.classList.add('leaders-dense-7');
    } else if (totalCards >= 3) {
      grid.classList.add('leaders-dense-4');
    }

    // 1. Render Kepala Balai (posisi paling kiri)
    renderLeader(kepalaCard, kepala, 'KEPALA BALAI BESAR POM DI PANGKAL PINANG', DEFAULT_KEPALA_NAME, DEFAULT_KEPALA_NIP);

    // 2. Render Kabag TU (posisi sebelah kanan Kepala Balai)
    renderLeader(kabagTuCard, kabag_tu, 'KABAG TATA USAHA BALAI BESAR POM DI PANGKAL PINANG', DEFAULT_KABAG_NAME, DEFAULT_KABAG_NIP);

    // 3. Remove existing dynamic saksi cards from the row
    grid.querySelectorAll('.dynamic-saksi-card').forEach(el => el.remove());

    // 4. Render each Saksi to the right of Kabag TU in the same single row
    list.forEach((s, idx) => {
      const card = document.createElement('div');
      card.className = 'leader-card leader-card-saksi dynamic-saksi-card signed';

      const roleTitle = (s.jabatan && s.jabatan.trim() && s.jabatan.toLowerCase() !== 'saksi' && s.jabatan !== '-')
        ? `SAKSI (${s.jabatan.toUpperCase()})`
        : `SAKSI ${list.length > 1 ? (idx + 1) : ''}`;

      const nipContent = (s.nip && s.nip !== '-')
        ? `NIP. ${escapeHtml(s.nip)}`
        : (s.jabatan && s.jabatan.toLowerCase() !== 'saksi' && s.jabatan !== '-' ? escapeHtml(s.jabatan) : '-');

      card.innerHTML = `
        <div class="leader-badge-role">${escapeHtml(roleTitle)}</div>
        <div class="leader-sig-box">
          <img src="${s.signatureDataUrl}" class="leader-sig-img" alt="TTD ${escapeHtml(s.name)}" loading="lazy">
        </div>
        <div class="leader-name">${escapeHtml(s.name)}</div>
        <div class="leader-name-divider"></div>
        <div class="leader-nip">${nipContent}</div>
      `;
      grid.appendChild(card);
    });
  }

  // 3. Render Employee Grid
  function updateGridDensity(count) {
    employeesGrid.classList.remove('density-compact', 'density-dense', 'density-micro', 'density-ultra');
    if (count > 80) {
      employeesGrid.classList.add('density-ultra');
    } else if (count > 60) {
      employeesGrid.classList.add('density-micro');
    } else if (count > 40) {
      employeesGrid.classList.add('density-dense');
    } else if (count > 20) {
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

      const nipHtml = (emp.nip && emp.nip !== '-')
        ? `<div class="emp-nip">NIP. ${escapeHtml(emp.nip)}</div>`
        : '';
      const jabatanHtml = (emp.jabatan && emp.jabatan !== '-' && emp.jabatan !== 'Pegawai Balai Besar POM di Pangkal Pinang')
        ? `<div class="emp-jabatan" title="${escapeHtml(emp.jabatan)}">${escapeHtml(emp.jabatan)}</div>`
        : '';

      card.innerHTML = `
        <span class="emp-seq-badge">#${index + 1}</span>
        <div class="emp-sig-box">
          <img src="${emp.signatureDataUrl}" class="emp-sig-img" alt="TTD ${escapeHtml(emp.name)}" loading="lazy">
        </div>
        <div class="emp-name" title="${escapeHtml(emp.name)}">${escapeHtml(emp.name)}</div>
        ${nipHtml}
        ${jabatanHtml}
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
    renderLeadershipAndWitnesses(payload.kepala, payload.kabag_tu, payload.saksi || []);
    renderEmployees(payload.pegawai);
    updateCounters(payload.meta);
  });

  socket.on('new_signature', (payload) => {
    const { record, state, meta } = payload;
    const isLeader = record.roleType === 'KEPALA' || record.roleType === 'KABAG_TU' || record.roleType === 'SAKSI';

    // Show toast
    showToast(record.name, record.jabatan || record.roleType, isLeader);

    // Update views
    renderLeadershipAndWitnesses(state.kepala, state.kabag_tu, state.saksi || []);
    renderEmployees(state.pegawai, record.id);
    updateCounters(meta);
  });

  socket.on('signature_deleted', (payload) => {
    renderLeadershipAndWitnesses(payload.state.kepala, payload.state.kabag_tu, payload.state.saksi || []);
    renderEmployees(payload.state.pegawai);
    updateCounters({
      total: (payload.state.kepala ? 1 : 0) + (payload.state.kabag_tu ? 1 : 0) + (payload.state.saksi ? payload.state.saksi.length : 0) + payload.state.pegawai.length,
      pegawaiCount: payload.state.pegawai.length
    });
  });

  socket.on('data_reset', () => {
    renderLeadershipAndWitnesses(null, null, []);
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

        // Calculate participant count and apply the exact optimal density tier for A3
        const empCards = clone.querySelectorAll('.employee-card');
        const count = empCards.length;
        const cloneGrid = clone.querySelector('#employeesGrid');

        if (cloneGrid) {
          cloneGrid.classList.remove(
            'density-compact', 'density-dense', 'density-micro', 'density-ultra',
            'a3-density-1', 'a3-density-2', 'a3-density-3', 'a3-density-4', 'a3-density-5'
          );
          if (count > 85) {
            cloneGrid.classList.add('a3-density-5'); // 11 columns (> 85 people)
          } else if (count > 65) {
            cloneGrid.classList.add('a3-density-4'); // 10 columns (Target: 70 - 80 people, perfectly fits in 1 page!)
          } else if (count > 45) {
            cloneGrid.classList.add('a3-density-3'); // 9 columns (46 - 65 people)
          } else if (count > 24) {
            cloneGrid.classList.add('a3-density-2'); // 8 columns (25 - 45 people)
          } else {
            cloneGrid.classList.add('a3-density-1'); // 7 columns (1 - 24 people)
          }
        }

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

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnFullscreen) {
    function updateFullscreenUi(isFullscreen) {
      if (isFullscreen) {
        document.body.classList.add('is-fullscreen');
        btnFullscreen.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
          <span>Keluar Fullscreen</span>
        `;
        btnFullscreen.classList.add('btn-primary');
        btnFullscreen.classList.remove('btn-navy');
      } else {
        document.body.classList.remove('is-fullscreen');
        btnFullscreen.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          <span>Layar Penuh</span>
        `;
        btnFullscreen.classList.remove('btn-primary');
        btnFullscreen.classList.add('btn-navy');
      }
    }

    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
          updateFullscreenUi(true);
        }).catch(err => {
          console.warn('Fullscreen request failed:', err);
          updateFullscreenUi(!document.body.classList.contains('is-fullscreen'));
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().then(() => {
            updateFullscreenUi(false);
          }).catch(() => {
            updateFullscreenUi(false);
          });
        } else {
          updateFullscreenUi(false);
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      updateFullscreenUi(!!document.fullscreenElement);
    });
  }

  // 7. QR Code Modal Handlers
  let cachedSignUrl = '';
  async function loadQrInfo() {
    const browserOrigin = window.location.origin;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    try {
      const res = await fetch('/api/info');
      const info = await res.json();
      
      // When hosted on Render / Cloud, ALWAYS use public domain URL
      if (!isLocalhost) {
        cachedSignUrl = `${browserOrigin}/sign`;
      } else if (info && info.mobileSignUrl) {
        cachedSignUrl = info.mobileSignUrl;
      } else {
        cachedSignUrl = `${browserOrigin}/sign`;
      }

      if (qrUrlText) qrUrlText.textContent = cachedSignUrl;
      if (qrImageEl) qrImageEl.src = `/api/qr-image?url=${encodeURIComponent(cachedSignUrl)}`;
    } catch (e) {
      console.error('Failed to load QR info:', e);
      cachedSignUrl = `${browserOrigin}/sign`;
      if (qrUrlText) qrUrlText.textContent = cachedSignUrl;
      if (qrImageEl) qrImageEl.src = `/api/qr-image?url=${encodeURIComponent(cachedSignUrl)}`;
    }
  }

  if (btnQrModal && qrModal) {
    btnQrModal.addEventListener('click', () => {
      loadQrInfo();
      qrModal.classList.add('active');
    });
  }

  if (btnCloseModal && qrModal) {
    btnCloseModal.addEventListener('click', () => {
      qrModal.classList.remove('active');
    });
  }

  if (qrModal) {
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) {
        qrModal.classList.remove('active');
      }
    });
  }

  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
      navigator.clipboard.writeText(cachedSignUrl || (qrUrlText ? qrUrlText.textContent : '')).then(() => {
        const originalText = btnCopyUrl.innerHTML;
        btnCopyUrl.innerHTML = `✓ Tersalin!`;
        setTimeout(() => {
          btnCopyUrl.innerHTML = originalText;
        }, 2000);
      });
    });
  }

  // 8. Superuser Login & Admin Dashboard Controller
  const btnAdminTools = document.getElementById('btnAdminTools');
  const adminLoginModal = document.getElementById('adminLoginModal');
  const adminPanelModal = document.getElementById('adminPanelModal');
  const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
  const btnClosePanelModal = document.getElementById('btnClosePanelModal');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const formAdminLogin = document.getElementById('formAdminLogin');
  const inputAdminUser = document.getElementById('inputAdminUser');
  const inputAdminPass = document.getElementById('inputAdminPass');
  const loginErrorAlert = document.getElementById('loginErrorAlert');

  // Pegawai tab elements
  const formAddPegawai = document.getElementById('formAddPegawai');
  const addPegawaiNama = document.getElementById('addPegawaiNama');
  const addPegawaiNip = document.getElementById('addPegawaiNip');
  const addPegawaiInstansi = document.getElementById('addPegawaiInstansi');
  const addPegawaiJabatan = document.getElementById('addPegawaiJabatan');
  const addPegawaiKeterangan = document.getElementById('addPegawaiKeterangan');
  const tbodyPegawaiList = document.getElementById('tbodyPegawaiList');
  const countPegawaiTotal = document.getElementById('countPegawaiTotal');
  const searchPegawaiAdmin = document.getElementById('searchPegawaiAdmin');

  // Edit Pegawai Modal elements
  const modalEditPegawai = document.getElementById('modalEditPegawai');
  const btnCloseEditPegawaiModal = document.getElementById('btnCloseEditPegawaiModal');
  const btnCancelEditPegawai = document.getElementById('btnCancelEditPegawai');
  const formEditPegawai = document.getElementById('formEditPegawai');
  const editPegawaiId = document.getElementById('editPegawaiId');
  const editPegawaiNama = document.getElementById('editPegawaiNama');
  const editPegawaiNip = document.getElementById('editPegawaiNip');
  const editPegawaiInstansi = document.getElementById('editPegawaiInstansi');
  const editPegawaiJabatan = document.getElementById('editPegawaiJabatan');
  const editPegawaiKeterangan = document.getElementById('editPegawaiKeterangan');

  // Signatures reorder elements
  const countSignaturesAdmin = document.getElementById('countSignaturesAdmin');
  const reorderListBox = document.getElementById('reorderListBox');
  const btnSaveReorder = document.getElementById('btnSaveReorder');

  // Quick Ops
  const btnSeedDemo = document.getElementById('btnSeedDemo');
  const btnResetAll = document.getElementById('btnResetAll');

  // Admin In-Memory Data
  let adminPegawaiData = [];
  let adminSignaturesList = []; // Array of employee signatures currently displayed

  function isAdminAuthenticated() {
    return sessionStorage.getItem('bpom_admin_auth') === 'true';
  }

  function openAdmin() {
    if (isAdminAuthenticated()) {
      adminPanelModal.classList.add('active');
      loadAdminPegawai();
      loadAdminSignatures();
    } else {
      if (inputAdminUser) inputAdminUser.value = '';
      if (inputAdminPass) inputAdminPass.value = '';
      if (loginErrorAlert) loginErrorAlert.style.display = 'none';
      adminLoginModal.classList.add('active');
    }
  }

  if (btnAdminTools) {
    btnAdminTools.addEventListener('click', openAdmin);
  }

  if (btnCloseLoginModal) {
    btnCloseLoginModal.addEventListener('click', () => {
      adminLoginModal.classList.remove('active');
    });
  }

  if (btnClosePanelModal) {
    btnClosePanelModal.addEventListener('click', () => {
      adminPanelModal.classList.remove('active');
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      sessionStorage.removeItem('bpom_admin_auth');
      adminPanelModal.classList.remove('active');
      showToast('Logout Berhasil', 'Anda telah keluar dari mode Superuser');
    });
  }

  // Click outside to close modals
  [adminLoginModal, adminPanelModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Login form handler
  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (inputAdminUser.value || '').trim();
      const password = (inputAdminPass.value || '').trim();

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
          sessionStorage.setItem('bpom_admin_auth', 'true');
          adminLoginModal.classList.remove('active');
          adminPanelModal.classList.add('active');
          showToast('Selamat Datang, Superuser!', 'Akses Kontrol Penuh Diaktifkan');
          loadAdminPegawai();
          loadAdminSignatures();
        } else {
          loginErrorAlert.textContent = data.message || 'Username atau password salah!';
          loginErrorAlert.style.display = 'block';
        }
      } catch (err) {
        loginErrorAlert.textContent = 'Gagal terhubung ke server.';
        loginErrorAlert.style.display = 'block';
      }
    });
  }

  // Tab switching
  const tabButtons = document.querySelectorAll('.admin-tab-btn');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(targetTab);
      if (pane) pane.classList.add('active');

      if (targetTab === 'tabPegawai') loadAdminPegawai();
      if (targetTab === 'tabSignatures') loadAdminSignatures();
    });
  });

  // Load Pegawai List
  async function loadAdminPegawai() {
    try {
      const res = await fetch('/api/pegawai');
      const json = await res.json();
      adminPegawaiData = json.data || [];
      renderPegawaiList(adminPegawaiData);
    } catch (err) {
      console.error('Error fetching admin pegawai:', err);
      if (tbodyPegawaiList) {
        tbodyPegawaiList.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 20px;">Gagal memuat daftar pegawai.</td></tr>`;
      }
    }
  }

  function renderPegawaiList(list) {
    if (!tbodyPegawaiList) return;
    if (countPegawaiTotal) countPegawaiTotal.textContent = list.length;

    if (list.length === 0) {
      tbodyPegawaiList.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">Tidak ada pegawai ditemukan.</td></tr>`;
      return;
    }

    tbodyPegawaiList.innerHTML = list.map((p, idx) => {
      let ketBadge = '';
      const ket = p.keterangan || (
        p.roleType === 'KEPALA' ? 'Kepala Balai Besar POM di Pangkal Pinang' :
        p.roleType === 'KABAG_TU' ? 'Kabag Tata Usaha Balai Besar POM di Pangkal Pinang' :
        p.roleType === 'SAKSI' ? 'Saksi' : 'Pegawai Balai Besar POM di Pangkal Pinang'
      );

      if (ket.includes('Kepala Balai') || p.roleType === 'KEPALA') {
        ketBadge = `<span style="font-size: 0.72rem; background: #fef3c7; color: #92400e; padding: 2px 7px; border-radius: 4px; font-weight: 700;">Kepala Balai</span>`;
      } else if (ket.includes('Kabag') || p.roleType === 'KABAG_TU') {
        ketBadge = `<span style="font-size: 0.72rem; background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; font-weight: 700;">Kabag TU</span>`;
      } else if (ket.toLowerCase().includes('saksi') || p.roleType === 'SAKSI') {
        ketBadge = `<span style="font-size: 0.72rem; background: #f3e8ff; color: #7e22ce; padding: 2px 7px; border-radius: 4px; font-weight: 700;">🤝 Saksi</span>`;
      } else {
        ketBadge = `<span style="font-size: 0.72rem; background: #f1f5f9; color: #475569; padding: 2px 7px; border-radius: 4px; font-weight: 500;">Pegawai</span>`;
      }

      return `
        <tr>
          <td style="text-align: center; font-weight: 600; color: #64748b;">${p.no || idx + 1}</td>
          <td>
            <div style="font-weight: 600; color: #002b5b;">${p.nama}</div>
          </td>
          <td style="font-family: monospace; font-size: 0.78rem;">${p.nip || '-'}</td>
          <td style="font-size: 0.78rem; color: #475569;">${p.instansi || '-'}</td>
          <td style="font-size: 0.78rem; color: #475569;">${p.jabatan || '-'}</td>
          <td>${ketBadge}</td>
          <td style="text-align: center; white-space: nowrap;">
            <button type="button" class="btn-admin-edit" data-id="${p.id || p.no}">
              ✏️ Edit
            </button>
            <button type="button" class="btn-admin-del" data-id="${p.id || p.no}" data-nama="${p.nama}">
              🗑️ Hapus
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach edit listeners
    tbodyPegawaiList.querySelectorAll('.btn-admin-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const found = adminPegawaiData.find(x => x.id === id || String(x.no) === id);
        if (found && modalEditPegawai) {
          editPegawaiId.value = found.id || found.no;
          editPegawaiNama.value = found.nama || '';
          editPegawaiNip.value = (found.nip && found.nip !== '-') ? found.nip : '';
          editPegawaiInstansi.value = found.instansi || 'Balai Besar POM di Pangkal Pinang';
          editPegawaiJabatan.value = found.jabatan || '';
          
          const defaultKet = found.keterangan || (
            found.roleType === 'KEPALA' ? 'Kepala Balai Besar POM di Pangkal Pinang' :
            found.roleType === 'KABAG_TU' ? 'Kabag Tata Usaha Balai Besar POM di Pangkal Pinang' :
            found.roleType === 'SAKSI' ? 'Saksi' : 'Pegawai Balai Besar POM di Pangkal Pinang'
          );
          if (editPegawaiKeterangan) {
            editPegawaiKeterangan.value = defaultKet;
          }

          modalEditPegawai.classList.add('active');
        }
      });
    });

    // Attach delete listeners
    tbodyPegawaiList.querySelectorAll('.btn-admin-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nama = btn.getAttribute('data-nama');
        if (confirm(`Apakah Anda yakin ingin menghapus pegawai "${nama}" dari database?`)) {
          try {
            const res = await fetch(`/api/admin/pegawai/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              showToast('Pegawai Dihapus', nama);
              loadAdminPegawai();
            } else {
              alert(data.message || 'Gagal menghapus pegawai');
            }
          } catch (err) {
            alert('Terjadi kesalahan jaringan.');
          }
        }
      });
    });
  }

  // Edit Pegawai Modal Close Handlers
  if (btnCloseEditPegawaiModal) {
    btnCloseEditPegawaiModal.addEventListener('click', () => {
      modalEditPegawai.classList.remove('active');
    });
  }

  if (btnCancelEditPegawai) {
    btnCancelEditPegawai.addEventListener('click', () => {
      modalEditPegawai.classList.remove('active');
    });
  }

  if (modalEditPegawai) {
    modalEditPegawai.addEventListener('click', (e) => {
      if (e.target === modalEditPegawai) {
        modalEditPegawai.classList.remove('active');
      }
    });
  }

  // Edit Pegawai Form Submit
  if (formEditPegawai) {
    formEditPegawai.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = editPegawaiId.value;
      const nama = editPegawaiNama.value.trim();
      const nip = editPegawaiNip.value.trim();
      const instansi = editPegawaiInstansi.value.trim();
      const jabatan = editPegawaiJabatan.value.trim();
      const keterangan = editPegawaiKeterangan ? editPegawaiKeterangan.value : '';

      if (!nama) {
        alert('Nama lengkap pegawai wajib diisi.');
        return;
      }

      try {
        const res = await fetch(`/api/admin/pegawai/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama, nip, instansi, jabatan, keterangan })
        });
        const data = await res.json();

        if (data.success) {
          modalEditPegawai.classList.remove('active');
          showToast('Data Berhasil Diperbarui', nama);
          loadAdminPegawai();
        } else {
          alert(data.message || 'Gagal memperbarui pegawai.');
        }
      } catch (err) {
        alert('Gagal menghubungi server.');
      }
    });
  }

  // Pegawai search filter
  if (searchPegawaiAdmin) {
    searchPegawaiAdmin.addEventListener('input', () => {
      const q = searchPegawaiAdmin.value.toLowerCase().trim();
      if (!q) {
        renderPegawaiList(adminPegawaiData);
        return;
      }
      const filtered = adminPegawaiData.filter(p =>
        (p.nama || '').toLowerCase().includes(q) ||
        (p.nip || '').toLowerCase().includes(q) ||
        (p.jabatan || '').toLowerCase().includes(q) ||
        (p.instansi || '').toLowerCase().includes(q) ||
        (p.keterangan || '').toLowerCase().includes(q)
      );
      renderPegawaiList(filtered);
    });
  }

  // Form add pegawai
  if (formAddPegawai) {
    formAddPegawai.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nama = addPegawaiNama.value.trim();
      const nip = addPegawaiNip.value.trim();
      const instansi = addPegawaiInstansi.value.trim();
      const jabatan = addPegawaiJabatan.value.trim();
      const keterangan = addPegawaiKeterangan ? addPegawaiKeterangan.value : 'Pegawai Balai Besar POM di Pangkal Pinang';

      if (!nama) {
        alert('Nama lengkap pegawai wajib diisi.');
        return;
      }

      try {
        const res = await fetch('/api/admin/pegawai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama, nip, instansi, jabatan, keterangan })
        });
        const data = await res.json();

        if (data.success) {
          showToast('Pegawai Berhasil Ditambahkan', nama);
          addPegawaiNama.value = '';
          addPegawaiNip.value = '';
          addPegawaiJabatan.value = '';
          if (addPegawaiKeterangan) addPegawaiKeterangan.value = 'Pegawai Balai Besar POM di Pangkal Pinang';
          loadAdminPegawai();
        } else {
          alert(data.message || 'Gagal menambahkan pegawai.');
        }
      } catch (err) {
        alert('Gagal menghubungi server.');
      }
    });
  }

  // Load Signatures for Reorder & Delete
  async function loadAdminSignatures() {
    try {
      const res = await fetch('/api/signatures');
      const json = await res.json();
      const data = json.data || {};

      adminSignaturesList = Array.isArray(data.pegawai) ? [...data.pegawai] : [];
      const saksiList = Array.isArray(data.saksi) ? data.saksi : [];
      if (countSignaturesAdmin) {
        const total = (data.kepala ? 1 : 0) + (data.kabag_tu ? 1 : 0) + saksiList.length + adminSignaturesList.length;
        countSignaturesAdmin.textContent = `${total} Peserta (${adminSignaturesList.length} Pegawai, ${saksiList.length} Saksi)`;
      }

      renderReorderList(adminSignaturesList, data.kepala, data.kabag_tu, saksiList);
    } catch (err) {
      console.error('Error fetching admin signatures:', err);
      if (reorderListBox) {
        reorderListBox.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">Gagal memuat tanda tangan.</div>`;
      }
    }
  }

  function renderReorderList(pegawaiList, kepala, kabag_tu, saksiList = []) {
    if (!reorderListBox) return;

    let html = '';

    // Show Leadership Cards as fixed top items
    if (kepala) {
      html += `
        <div class="reorder-item-row" style="background: #fffbeb; border-color: #fde68a;">
          <div class="reorder-item-left">
            <span class="reorder-badge-num" style="background: #fef3c7; color: #92400e;">⭐ 1</span>
            <div>
              <div class="reorder-name-text">${kepala.name}</div>
              <div class="reorder-sub-text">Pimpinan: Kepala Balai (Kiri Atas - Terkunci)</div>
            </div>
            ${kepala.signatureDataUrl ? `<img src="${kepala.signatureDataUrl}" class="reorder-sig-preview" alt="TTD">` : ''}
          </div>
          <button type="button" class="btn-admin-del btn-del-sig" data-id="${kepala.id}" data-name="${kepala.name}">
            Hapus
          </button>
        </div>
      `;
    }

    if (kabag_tu) {
      html += `
        <div class="reorder-item-row" style="background: #fffbeb; border-color: #fde68a;">
          <div class="reorder-item-left">
            <span class="reorder-badge-num" style="background: #fef3c7; color: #92400e;">⭐ 2</span>
            <div>
              <div class="reorder-name-text">${kabag_tu.name}</div>
              <div class="reorder-sub-text">Pimpinan: Kabag TU (Kanan Atas - Terkunci)</div>
            </div>
            ${kabag_tu.signatureDataUrl ? `<img src="${kabag_tu.signatureDataUrl}" class="reorder-sig-preview" alt="TTD">` : ''}
          </div>
          <button type="button" class="btn-admin-del btn-del-sig" data-id="${kabag_tu.id}" data-name="${kabag_tu.name}">
            Hapus
          </button>
        </div>
      `;
    }

    // Show Witnesses (Saksi) in Leadership & Witnesses Row
    if (Array.isArray(saksiList) && saksiList.length > 0) {
      saksiList.forEach((s, sIdx) => {
        html += `
          <div class="reorder-item-row" style="background: #f0fdf4; border-color: #bbf7d0;">
            <div class="reorder-item-left">
              <span class="reorder-badge-num" style="background: #dcfce7; color: #166534;">🤝 ${sIdx + 1}</span>
              <div>
                <div class="reorder-name-text">${s.name}</div>
                <div class="reorder-sub-text">Saksi: Baris Pimpinan & Para Saksi ${s.jabatan ? `(${s.jabatan})` : ''}</div>
              </div>
              ${s.signatureDataUrl ? `<img src="${s.signatureDataUrl}" class="reorder-sig-preview" alt="TTD">` : ''}
            </div>
            <button type="button" class="btn-admin-del btn-del-sig" data-id="${s.id}" data-name="${s.name}">
              Hapus
            </button>
          </div>
        `;
      });
    }

    if (pegawaiList.length === 0) {
      html += `<div style="text-align: center; color: #64748b; padding: 24px;">Belum ada pegawai yang menandatangani komitmen.</div>`;
    } else {
      pegawaiList.forEach((p, idx) => {
        html += `
          <div class="reorder-item-row" data-id="${p.id}">
            <div class="reorder-item-left">
              <span class="reorder-badge-num">#${idx + 1}</span>
              <div>
                <div class="reorder-name-text">${p.name}</div>
                <div class="reorder-sub-text">${p.timestampFormatted || p.createdAt || '-'}</div>
              </div>
              ${p.signatureDataUrl ? `<img src="${p.signatureDataUrl}" class="reorder-sig-preview" alt="TTD">` : ''}
            </div>

            <div class="reorder-actions">
              <button type="button" class="btn-arrow-move btn-move-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Pindahkan ke atas">▲</button>
              <button type="button" class="btn-arrow-move btn-move-down" data-idx="${idx}" ${idx === pegawaiList.length - 1 ? 'disabled' : ''} title="Pindahkan ke bawah">▼</button>
              <button type="button" class="btn-admin-del btn-del-sig" data-id="${p.id}" data-name="${p.name}">
                Hapus
              </button>
            </div>
          </div>
        `;
      });
    }

    reorderListBox.innerHTML = html;

    // Attach Move Up / Down listeners
    reorderListBox.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx > 0) {
          const temp = adminSignaturesList[idx];
          adminSignaturesList[idx] = adminSignaturesList[idx - 1];
          adminSignaturesList[idx - 1] = temp;
          renderReorderList(adminSignaturesList, kepala, kabag_tu);
        }
      });
    });

    reorderListBox.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx < adminSignaturesList.length - 1) {
          const temp = adminSignaturesList[idx];
          adminSignaturesList[idx] = adminSignaturesList[idx + 1];
          adminSignaturesList[idx + 1] = temp;
          renderReorderList(adminSignaturesList, kepala, kabag_tu);
        }
      });
    });

    // Attach Delete Single Signature listeners
    reorderListBox.querySelectorAll('.btn-del-sig').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (confirm(`Apakah Anda yakin ingin menghapus tanda tangan dari "${name}"?`)) {
          try {
            const res = await fetch(`/api/signatures/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
              showToast('Tanda Tangan Dihapus', name);
              loadAdminSignatures();
            } else {
              alert(data.message || 'Gagal menghapus tanda tangan');
            }
          } catch (err) {
            alert('Gagal menghubungi server.');
          }
        }
      });
    });
  }

  // Save Reordered Signatures
  if (btnSaveReorder) {
    btnSaveReorder.addEventListener('click', async () => {
      const orderedIds = adminSignaturesList.map(p => p.id);
      try {
        btnSaveReorder.disabled = true;
        btnSaveReorder.innerHTML = '<span>⏳ Menyimpan...</span>';

        const res = await fetch('/api/signatures/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds })
        });
        const data = await res.json();

        if (data.success) {
          showToast('Urutan Berhasil Disimpan', 'Posisi tanda tangan piagam diperbarui');
        } else {
          alert(data.message || 'Gagal menyimpan urutan');
        }
      } catch (err) {
        alert('Gagal menghubungi server.');
      } finally {
        btnSaveReorder.disabled = false;
        btnSaveReorder.innerHTML = '<span>💾 Simpan Urutan ke Supabase</span>';
      }
    });
  }

  // Quick Ops: Seed Simulation Data
  if (btnSeedDemo) {
    btnSeedDemo.addEventListener('click', async () => {
      if (confirm('Apakah Anda ingin memuat data simulasi tanda tangan (6 peserta)? Data lama akan ditimpa contoh.')) {
        try {
          const res = await fetch('/api/seed', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast('Data Simulasi Berhasil Dimuat', '6 Tanda Tangan Contoh');
            loadAdminSignatures();
          }
        } catch (err) {
          alert('Gagal memuat data simulasi');
        }
      }
    });
  }

  // Quick Ops: Reset All
  if (btnResetAll) {
    btnResetAll.addEventListener('click', async () => {
      if (confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA tanda tangan di dashboard dan Supabase?')) {
        if (confirm('Konfirmasi Terakhir: Seluruh tanda tangan akan dikosongkan. Lanjutkan?')) {
          try {
            const res = await fetch('/api/reset', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
              showToast('Piagam Telah Direset', 'Semua tanda tangan dikosongkan');
              loadAdminSignatures();
            }
          } catch (err) {
            alert('Gagal mereset data');
          }
        }
      }
    });
  }

  // Socket listener for real-time pegawai updates
  if (typeof io !== 'undefined') {
    socket.on('pegawai_updated', (payload) => {
      if (payload && payload.data) {
        adminPegawaiData = payload.data;
        if (adminPanelModal && adminPanelModal.classList.contains('active')) {
          renderPegawaiList(adminPegawaiData);
        }
      }
    });
  }

  // Load QR info once in background
  loadQrInfo();
});
