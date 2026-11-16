/**
 * Participant Digital Signature Pad - Balai Besar POM di Pangkalpinang
 * Streamlined selection for 55 officers:
 * - Direct dropdown without search filter or extra labels
 * - Only Kepala Balai and Kabag TU show official NIP & Jabatan cards
 * - Regular staff (53 officers) proceed directly to signature without NIP or Jabatan clutter
 */

document.addEventListener('DOMContentLoaded', () => {
  // Canvas Elements
  const canvas = document.getElementById('signatureCanvas');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const ctx = canvas.getContext('2d');

  const btnClear = document.getElementById('btnClear');
  const btnUndo = document.getElementById('btnUndo');
  const form = document.getElementById('signatureForm');
  const btnSubmit = document.getElementById('btnSubmit');
  const colorDots = document.querySelectorAll('.color-dot');
  const commitmentCheck = document.getElementById('commitmentCheck');

  // Mode Selection Elements
  const btnModeNominatif = document.getElementById('btnModeNominatif');
  const btnModeManual = document.getElementById('btnModeManual');
  const sectionNominatif = document.getElementById('sectionNominatif');
  const sectionManual = document.getElementById('sectionManual');

  // Nominatif Selection Elements
  const selectPegawai = document.getElementById('selectPegawai');
  const alertAlreadySigned = document.getElementById('alertAlreadySigned');

  // Leadership Detail Card (Only visible for Kepala & Kabag TU)
  const pegawaiDetailCard = document.getElementById('pegawaiDetailCard');
  const dispNama = document.getElementById('dispNama');
  const dispRoleBadge = document.getElementById('dispRoleBadge');
  const dispNip = document.getElementById('dispNip');
  const dispJabatan = document.getElementById('dispJabatan');
  const dispLeaderBox = document.getElementById('dispLeaderBox');
  const dispLeaderText = document.getElementById('dispLeaderText');

  // Manual Input Elements
  const manualNamaLengkap = document.getElementById('manualNamaLengkap');
  const manualNip = document.getElementById('manualNip');
  const manualJabatan = document.getElementById('manualJabatan');

  // Hidden Final Inputs
  const finalNama = document.getElementById('finalNama');
  const finalNip = document.getElementById('finalNip');
  const finalJabatan = document.getElementById('finalJabatan');

  // Screens
  const formSection = document.getElementById('formSection');
  const successScreen = document.getElementById('successScreen');
  const btnSignAgain = document.getElementById('btnSignAgain');
  const previewSigImg = document.getElementById('previewSigImg');
  const previewName = document.getElementById('previewName');
  const previewNip = document.getElementById('previewNip');
  const previewRole = document.getElementById('previewRole');

  // Application State
  let currentMode = 'nominatif'; // 'nominatif' or 'manual'
  let pegawaiList = [];
  let existingSignatures = [];
  let selectedPegawaiData = null;

  // Drawing state
  let isDrawing = false;
  let currentColor = '#002b5b'; // Official BPOM Navy ink
  let strokeHistory = [];
  let currentStroke = [];
  let hasDrawn = false;

  // 1. Setup Canvas with Device Pixel Ratio for Crisp Retina Display
  function setupCanvas() {
    const rect = canvasWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `200px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5.0;
    ctx.strokeStyle = currentColor;

    redrawAllStrokes();
  }

  setupCanvas();
  window.addEventListener('resize', () => {
    setupCanvas();
  });

  // Color picker
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      currentColor = dot.dataset.color;
      ctx.strokeStyle = currentColor;
    });
  });

  // 2. Pointer Drawing Logic (Smooth, Bold Executive Pen)
  function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) { }

    const pos = getCoordinates(e);
    currentStroke = [{ x: pos.x, y: pos.y, color: currentColor }];

    ctx.lineWidth = 5.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.stroke();

    hasDrawn = true;
    canvasWrapper.classList.add('has-signature');
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getCoordinates(e);
    currentStroke.push({ x: pos.x, y: pos.y, color: currentColor });

    ctx.lineWidth = 5.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;

    const len = currentStroke.length;
    if (len >= 3) {
      const p0 = currentStroke[len - 3];
      const p1 = currentStroke[len - 2];
      const p2 = currentStroke[len - 1];

      const m1x = (p0.x + p1.x) / 2;
      const m1y = (p0.y + p1.y) / 2;
      const m2x = (p1.x + p2.x) / 2;
      const m2y = (p1.y + p2.y) / 2;

      ctx.beginPath();
      ctx.moveTo(m1x, m1y);
      ctx.quadraticCurveTo(p1.x, p1.y, m2x, m2y);
      ctx.stroke();
    } else if (len === 2) {
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      ctx.lineTo(currentStroke[1].x, currentStroke[1].y);
      ctx.stroke();
    }
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) { }

    if (currentStroke.length > 0) {
      strokeHistory.push([...currentStroke]);
      currentStroke = [];
    }
  }

  canvas.addEventListener('pointerdown', startDrawing);
  canvas.addEventListener('pointermove', draw);
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);

  function redrawAllStrokes() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (strokeHistory.length === 0) {
      hasDrawn = false;
      canvasWrapper.classList.remove('has-signature');
      return;
    }

    hasDrawn = true;
    canvasWrapper.classList.add('has-signature');

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5.0;

    strokeHistory.forEach(stroke => {
      if (stroke.length === 0) return;
      ctx.strokeStyle = stroke[0].color || currentColor;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);

      if (stroke.length === 1) {
        ctx.lineTo(stroke[0].x + 0.1, stroke[0].y + 0.1);
        ctx.stroke();
        return;
      }

      if (stroke.length === 2) {
        ctx.lineTo(stroke[1].x, stroke[1].y);
        ctx.stroke();
        return;
      }

      for (let i = 1; i < stroke.length - 1; i++) {
        const xc = (stroke[i].x + stroke[i + 1].x) / 2;
        const yc = (stroke[i].y + stroke[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, xc, yc);
      }
      ctx.lineTo(stroke[stroke.length - 1].x, stroke[stroke.length - 1].y);
      ctx.stroke();
    });

    ctx.strokeStyle = currentColor;
  }

  btnClear.addEventListener('click', () => {
    strokeHistory = [];
    currentStroke = [];
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasDrawn = false;
    canvasWrapper.classList.remove('has-signature');
  });

  btnUndo.addEventListener('click', () => {
    if (strokeHistory.length > 0) {
      strokeHistory.pop();
      redrawAllStrokes();
    }
  });

  // 3. Convert Drawn Strokes into High-Definition Vector SVG Data URL (Garis Tegas)
  function convertStrokesToSvgDataUrl(strokes, color = '#002b5b') {
    if (!strokes || strokes.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    strokes.forEach(s => s.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }));

    if (!isFinite(minX)) return null;

    const pad = 12;
    const rawW = maxX - minX;
    const rawH = maxY - minY;
    const w = Math.max(rawW + pad * 2, 70);
    const h = Math.max(rawH + pad * 2, 35);
    const offsetX = minX - pad;
    const offsetY = minY - pad;

    let d = '';
    strokes.forEach(stroke => {
      if (!stroke || stroke.length === 0) return;
      if (stroke.length === 1) {
        const p = stroke[0];
        const x = (p.x - offsetX).toFixed(1);
        const y = (p.y - offsetY).toFixed(1);
        d += ` M ${x} ${y} l 0.1 0.1`;
        return;
      }
      if (stroke.length === 2) {
        const p0 = stroke[0], p1 = stroke[1];
        d += ` M ${(p0.x - offsetX).toFixed(1)} ${(p0.y - offsetY).toFixed(1)} L ${(p1.x - offsetX).toFixed(1)} ${(p1.y - offsetY).toFixed(1)}`;
        return;
      }
      const p0 = stroke[0];
      d += ` M ${(p0.x - offsetX).toFixed(1)} ${(p0.y - offsetY).toFixed(1)}`;
      for (let i = 1; i < stroke.length - 1; i++) {
        const p1 = stroke[i];
        const p2 = stroke[i + 1];
        const xc = ((p1.x + p2.x) / 2 - offsetX).toFixed(1);
        const yc = ((p1.y + p2.y) / 2 - offsetY).toFixed(1);
        d += ` Q ${(p1.x - offsetX).toFixed(1)} ${(p1.y - offsetY).toFixed(1)}, ${xc} ${yc}`;
      }
      const last = stroke[stroke.length - 1];
      d += ` L ${(last.x - offsetX).toFixed(1)} ${(last.y - offsetY).toFixed(1)}`;
    });

    const strokeCol = color || '#002b5b';
    const strokeWidth = Math.max(3.8, h * 0.046).toFixed(1);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"><path d="${d.trim()}" fill="none" stroke="${strokeCol}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    try {
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${base64}`;
    } catch (err) {
      return null;
    }
  }

  // 4. Fetch Pegawai List and Existing Signatures
  async function loadData() {
    try {
      const [resPegawai, resSignatures] = await Promise.all([
        fetch('/api/pegawai').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/signatures').then(r => r.json()).catch(() => ({ data: {} }))
      ]);

      if (Array.isArray(resPegawai)) {
        pegawaiList = resPegawai;
      } else if (resPegawai && Array.isArray(resPegawai.data)) {
        pegawaiList = resPegawai.data;
      } else {
        pegawaiList = [];
      }

      existingSignatures = [];
      if (resSignatures && resSignatures.data) {
        if (resSignatures.data.kepala) existingSignatures.push(resSignatures.data.kepala);
        if (resSignatures.data.kabag_tu) existingSignatures.push(resSignatures.data.kabag_tu);
        if (Array.isArray(resSignatures.data.pegawai)) {
          existingSignatures.push(...resSignatures.data.pegawai);
        }
      } else if (Array.isArray(resSignatures)) {
        existingSignatures = resSignatures;
      }

      renderPegawaiDropdown();
    } catch (err) {
      console.error('Error loading data:', err);
      selectPegawai.innerHTML = `<option value="" disabled selected>-- Gagal memuat daftar, gunakan Mode Input Manual --</option>`;
    }
  }

  function isPegawaiSigned(nama) {
    if (!nama) return false;
    const clean = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = clean(nama);
    return existingSignatures.some(sig => clean(sig.name) === target);
  }

  function renderPegawaiDropdown() {
    const prevSelectedNo = selectedPegawaiData ? selectedPegawaiData.no : null;

    selectPegawai.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Pilih Nama Pegawai';
    defaultOption.disabled = true;
    defaultOption.selected = !prevSelectedNo;
    selectPegawai.appendChild(defaultOption);

    // Split into Leadership, Witnesses (Saksi), and Staff
    const leaders = pegawaiList.filter(p => p.roleType === 'KEPALA' || p.roleType === 'KABAG_TU');
    const witnesses = pegawaiList.filter(p => p.roleType === 'SAKSI' || (p.keterangan && p.keterangan.toLowerCase().includes('saksi')));
    const staff = pegawaiList.filter(p => p.roleType !== 'KEPALA' && p.roleType !== 'KABAG_TU' && p.roleType !== 'SAKSI' && !(p.keterangan && p.keterangan.toLowerCase().includes('saksi')));

    if (leaders.length > 0) {
      const optGroupLeaders = document.createElement('optgroup');
      optGroupLeaders.label = '⭐ PIMPINAN BALAI BESAR POM DI PANGKAL PINANG';
      leaders.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.no;
        const signedMark = isPegawaiSigned(p.nama) ? '✓ [Sudah TTD] ' : '';
        const roleLabel = p.roleType === 'KEPALA' ? ' (Kepala Balai)' : ' (Kabag TU)';
        opt.textContent = `${signedMark}${p.nama}${roleLabel}`;
        if (prevSelectedNo === p.no) opt.selected = true;
        optGroupLeaders.appendChild(opt);
      });
      selectPegawai.appendChild(optGroupLeaders);
    }

    if (witnesses.length > 0) {
      const optGroupWitnesses = document.createElement('optgroup');
      optGroupWitnesses.label = '🤝 SAKSI';
      witnesses.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.no;
        const signedMark = isPegawaiSigned(p.nama) ? '✓ [Sudah TTD] ' : '';
        opt.textContent = `${signedMark}${p.nama} (Saksi)`;
        if (prevSelectedNo === p.no) opt.selected = true;
        optGroupWitnesses.appendChild(opt);
      });
      selectPegawai.appendChild(optGroupWitnesses);
    }

    if (staff.length > 0) {
      const optGroupStaff = document.createElement('optgroup');
      optGroupStaff.label = `👥 SEGENAP PEGAWAI (${staff.length} Pegawai)`;
      staff.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.no;
        const signedMark = isPegawaiSigned(p.nama) ? '✓ [Sudah TTD] ' : '';
        opt.textContent = `${signedMark}${p.nama}`;
        if (prevSelectedNo === p.no) opt.selected = true;
        optGroupStaff.appendChild(opt);
      });
      selectPegawai.appendChild(optGroupStaff);
    }

    if (prevSelectedNo && pegawaiList.some(p => p.no === prevSelectedNo)) {
      selectPegawai.value = prevSelectedNo;
    }
  }

  // Handle Pegawai Selection
  function onPegawaiSelected(pegawai) {
    if (!pegawai) {
      selectedPegawaiData = null;
      if (pegawaiDetailCard) pegawaiDetailCard.style.display = 'none';
      if (alertAlreadySigned) alertAlreadySigned.style.display = 'none';
      finalNama.value = '';
      finalNip.value = '';
      finalJabatan.value = '';
      return;
    }

    selectedPegawaiData = pegawai;

    // Check signed status
    const alreadySigned = isPegawaiSigned(pegawai.nama);
    if (alertAlreadySigned) alertAlreadySigned.style.display = alreadySigned ? 'flex' : 'none';

    // Show NIP & Jabatan card ONLY for Kepala Balai and Kabag TU
    if (pegawai.roleType === 'KEPALA') {
      // Alex Sander
      if (dispRoleBadge) {
        dispRoleBadge.textContent = 'KEPALA BALAI';
        dispRoleBadge.className = 'detail-role-badge badge-pimpinan';
      }
      if (dispNama) dispNama.textContent = pegawai.nama;
      if (dispNip) dispNip.textContent = pegawai.nip || '19791212 200604 1 005';
      if (dispJabatan) dispJabatan.textContent = pegawai.jabatan || 'Kepala Balai Besar POM di Pangkal Pinang';

      if (dispLeaderBox) {
        dispLeaderBox.style.display = 'flex';
        if (dispLeaderText) dispLeaderText.textContent = 'Posisi tanda tangan: Pimpinan Utama (Kiri Atas Piagam)';
      }

      finalNama.value = pegawai.nama;
      finalNip.value = '19791212 200604 1 005';
      finalJabatan.value = 'Kepala Balai Besar POM di Pangkal Pinang';

      if (pegawaiDetailCard) pegawaiDetailCard.style.display = 'block';

    } else if (pegawai.roleType === 'KABAG_TU') {
      // Mardianto
      if (dispRoleBadge) {
        dispRoleBadge.textContent = 'KABAG TATA USAHA';
        dispRoleBadge.className = 'detail-role-badge badge-kabag';
      }
      if (dispNama) dispNama.textContent = pegawai.nama;
      if (dispNip) dispNip.textContent = pegawai.nip || '19830326 200812 1 001';
      if (dispJabatan) dispJabatan.textContent = pegawai.jabatan || 'Kepala Bagian Tata Usaha Balai Besar POM di Pangkal Pinang';

      if (dispLeaderBox) {
        dispLeaderBox.style.display = 'flex';
        if (dispLeaderText) dispLeaderText.textContent = 'Posisi tanda tangan: Sebelah Kanan Kepala Balai (Kanan Atas)';
      }

      finalNama.value = pegawai.nama;
      finalNip.value = '19830326 200812 1 001';
      finalJabatan.value = 'Kepala Bagian Tata Usaha Balai Besar POM di Pangkal Pinang';

      if (pegawaiDetailCard) pegawaiDetailCard.style.display = 'block';

    } else if (pegawai.roleType === 'SAKSI' || (pegawai.keterangan && pegawai.keterangan.toLowerCase().includes('saksi'))) {
      if (pegawaiDetailCard) pegawaiDetailCard.style.display = 'none';
      finalNama.value = pegawai.nama;
      finalNip.value = (pegawai.nip && pegawai.nip !== '-') ? pegawai.nip : '-';
      finalJabatan.value = pegawai.jabatan || 'Saksi';
    } else {
      // Segenap Pegawai: TIDAK menampilkan box NIP dan TIDAK menampilkan/diberi keterangan jabatan
      if (pegawaiDetailCard) pegawaiDetailCard.style.display = 'none';

      finalNama.value = pegawai.nama;
      finalNip.value = '-';
      finalJabatan.value = '';
    }
  }

  // Dropdown Change Event
  selectPegawai.addEventListener('change', () => {
    const val = parseInt(selectPegawai.value, 10);
    const found = pegawaiList.find(p => p.no === val);
    onPegawaiSelected(found);
  });

  // Mode Switcher (Guarded)
  if (btnModeNominatif) {
    btnModeNominatif.addEventListener('click', () => {
      currentMode = 'nominatif';
      btnModeNominatif.classList.add('active');
      if (btnModeManual) btnModeManual.classList.remove('active');
      if (sectionNominatif) sectionNominatif.style.display = 'block';
      if (sectionManual) sectionManual.style.display = 'none';
      if (selectPegawai) selectPegawai.required = true;
    });
  }

  if (btnModeManual) {
    btnModeManual.addEventListener('click', () => {
      currentMode = 'manual';
      btnModeManual.classList.add('active');
      if (btnModeNominatif) btnModeNominatif.classList.remove('active');
      if (sectionNominatif) sectionNominatif.style.display = 'none';
      if (sectionManual) sectionManual.style.display = 'block';
      if (selectPegawai) selectPegawai.required = false;
    });
  }

  // 6. Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let submitName = '';
    let submitNip = '';
    let submitJabatan = '';

    if (currentMode === 'nominatif') {
      if (!selectedPegawaiData) {
        alert('Silakan pilih nama pegawai dari daftar terlebih dahulu sebelum menandatangani.');
        selectPegawai.focus();
        return;
      }
      submitName = finalNama.value.trim() || selectedPegawaiData.nama;
      submitNip = finalNip.value.trim() || '-';
      submitJabatan = finalJabatan.value.trim() || '';
    } else {
      // Manual mode
      submitName = manualNamaLengkap.value.trim();
      submitNip = manualNip.value.trim() || '-';
      submitJabatan = manualJabatan.value.trim() || '';

      if (!submitName) {
        alert('Silakan isi Nama Lengkap Anda.');
        manualNamaLengkap.focus();
        return;
      }
    }

    if (!hasDrawn || strokeHistory.length === 0) {
      alert('Silakan bubuhkan tanda tangan digital Anda pada kotak tanda tangan.');
      canvasWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!commitmentCheck.checked) {
      alert('Harap centang persetujuan komitmen Zona Integritas.');
      commitmentCheck.focus();
      return;
    }

    // High definition vector SVG signature with bold lines (garis tegas)
    const signatureDataUrl = convertStrokesToSvgDataUrl(strokeHistory, currentColor) || canvas.toDataURL('image/png');

    // UI Loading state
    btnSubmit.disabled = true;
    const originalBtnContent = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `<span class="spinner"></span> <span>Menyimpan Komitmen...</span>`;

    try {
      const response = await fetch('/api/signatures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: submitName,
          nip: submitNip,
          jabatan: submitJabatan,
          signatureDataUrl
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Success screen display
        previewSigImg.src = signatureDataUrl;
        previewName.textContent = submitName;

        if (submitNip && submitNip !== '-') {
          previewNip.textContent = `NIP. ${submitNip}`;
          previewNip.style.display = 'block';
        } else {
          previewNip.textContent = '';
          previewNip.style.display = 'none';
        }

        if (submitJabatan && submitJabatan !== '-') {
          previewRole.textContent = submitJabatan;
          previewRole.style.display = 'block';
        } else {
          previewRole.textContent = '';
          previewRole.style.display = 'none';
        }

        formSection.style.display = 'none';
        successScreen.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Refresh existing signatures list so status is up-to-date
        fetch('/api/signatures')
          .then(r => r.json())
          .then(res => {
            const list = [];
            if (res && res.data) {
              if (res.data.kepala) list.push(res.data.kepala);
              if (res.data.kabag_tu) list.push(res.data.kabag_tu);
              if (Array.isArray(res.data.pegawai)) list.push(...res.data.pegawai);
            } else if (Array.isArray(res)) {
              list.push(...res);
            }
            existingSignatures = list;
          })
          .catch(() => { });
      } else {
        alert(result.message || 'Gagal menyimpan tanda tangan. Silakan coba kembali.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Terjadi kesalahan koneksi ke server. Pastikan perangkat Anda terhubung ke jaringan.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnContent;
    }
  });

  // 7. Sign Again (Reset form for next participant)
  btnSignAgain.addEventListener('click', () => {
    form.reset();
    selectedPegawaiData = null;
    if (pegawaiDetailCard) pegawaiDetailCard.style.display = 'none';
    if (alertAlreadySigned) alertAlreadySigned.style.display = 'none';

    // Reset mode to nominatif
    if (btnModeNominatif) btnModeNominatif.click();
    renderPegawaiDropdown();

    // Clear signature canvas
    strokeHistory = [];
    currentStroke = [];
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasDrawn = false;
    canvasWrapper.classList.remove('has-signature');

    successScreen.style.display = 'none';
    formSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Real-time socket sync
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('pegawai_updated', (payload) => {
      if (payload && payload.data) {
        pegawaiList = payload.data;
        renderPegawaiDropdown();
      }
    });
    socket.on('new_signature', () => {
      loadData();
    });
    socket.on('signature_deleted', () => {
      loadData();
    });
    socket.on('data_reset', () => {
      loadData();
    });
  }

  // Initial Data Load
  loadData();
});
