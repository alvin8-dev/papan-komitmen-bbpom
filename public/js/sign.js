/**
 * Participant Digital Signature Pad - Balai Besar POM di Pangkalpinang
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('signatureCanvas');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const ctx = canvas.getContext('2d');
  
  const btnClear = document.getElementById('btnClear');
  const btnUndo = document.getElementById('btnUndo');
  const form = document.getElementById('signatureForm');
  const btnSubmit = document.getElementById('btnSubmit');
  const selectJabatan = document.getElementById('selectJabatan');
  const customJabatanGroup = document.getElementById('customJabatanGroup');
  const inputCustomJabatan = document.getElementById('customJabatan');

  const successScreen = document.getElementById('successScreen');
  const formSection = document.getElementById('formSection');
  const btnSignAgain = document.getElementById('btnSignAgain');
  const colorDots = document.querySelectorAll('.color-dot');

  // Drawing state
  let isDrawing = false;
  let currentColor = '#002b5b'; // Official BPOM Navy ink
  let strokeHistory = [];
  let currentStroke = [];
  let hasDrawn = false;

  // 1. Setup Canvas with Device Pixel Ratio for Retina/Crispness
  function setupCanvas() {
    const rect = canvasWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Save previous drawing if any
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `200px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = currentColor;

    // Restore strokes
    redrawAllStrokes();
  }

  // Initial setup & resize observer
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

  // 2. Pointer & Touch Drawing Logic
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
    canvas.setPointerCapture(e.pointerId);
    
    const pos = getCoordinates(e);
    currentStroke = [{ x: pos.x, y: pos.y, color: currentColor }];

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    // Draw dot for single tap
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

    if (currentStroke.length > 2) {
      const p1 = currentStroke[currentStroke.length - 2];
      const p2 = currentStroke[currentStroke.length - 1];
      const xc = (p1.x + p2.x) / 2;
      const yc = (p1.y + p2.y) / 2;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
      ctx.stroke();
    } else {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch(err) {}

    if (currentStroke.length > 0) {
      strokeHistory.push([...currentStroke]);
      currentStroke = [];
    }
  }

  canvas.addEventListener('pointerdown', startDrawing);
  canvas.addEventListener('pointermove', draw);
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);

  // Redraw all strokes from history
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

  // Clear Canvas
  btnClear.addEventListener('click', () => {
    strokeHistory = [];
    currentStroke = [];
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasDrawn = false;
    canvasWrapper.classList.remove('has-signature');
  });

  // Undo Stroke
  btnUndo.addEventListener('click', () => {
    if (strokeHistory.length > 0) {
      strokeHistory.pop();
      redrawAllStrokes();
    }
  });

  // 3. Jabatan Select Handling
  selectJabatan.addEventListener('change', () => {
    if (selectJabatan.value === '__OTHER__') {
      customJabatanGroup.style.display = 'block';
      inputCustomJabatan.required = true;
      inputCustomJabatan.focus();
    } else {
      customJabatanGroup.style.display = 'none';
      inputCustomJabatan.required = false;
    }
  });

  // 4. Crop whitespace around signature for optimal display
  function getTrimmedSignatureDataUrl() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) return null;

    // Add safe padding
    const padding = 16 * dpr;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = cropW;
    trimmedCanvas.height = cropH;
    const tCtx = trimmedCanvas.getContext('2d');
    tCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    return trimmedCanvas.toDataURL('image/png');
  }

  // 5. Form Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('namaLengkap').value.trim();
    const nip = document.getElementById('nip').value.trim();
    
    let jabatan = selectJabatan.value;
    if (jabatan === '__OTHER__') {
      jabatan = inputCustomJabatan.value.trim();
    }

    if (!jabatan) {
      alert('Silakan pilih atau isi Jabatan Anda.');
      selectJabatan.focus();
      return;
    }

    if (!hasDrawn || strokeHistory.length === 0) {
      alert('Silakan bubuhkan tanda tangan digital Anda pada kotak tanda tangan di atas.');
      canvasWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const commitmentChecked = document.getElementById('commitmentCheck').checked;
    if (!commitmentChecked) {
      alert('Harap centang persetujuan komitmen.');
      return;
    }

    const signatureDataUrl = getTrimmedSignatureDataUrl() || canvas.toDataURL('image/png');

    // UI Loading state
    btnSubmit.disabled = true;
    const originalBtnContent = btnSubmit.innerHTML;
    btnSubmit.innerHTML = `<span class="spinner"></span> <span>Mengirimkan Komitmen...</span>`;

    try {
      const response = await fetch('/api/signatures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          nip,
          jabatan,
          signatureDataUrl
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Show success screen
        document.getElementById('previewSigImg').src = signatureDataUrl;
        document.getElementById('previewName').textContent = name;
        document.getElementById('previewNip').textContent = `NIP. ${nip}`;
        document.getElementById('previewRole').textContent = jabatan;

        formSection.style.display = 'none';
        successScreen.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // 6. Sign Again (Reset form for next officer)
  btnSignAgain.addEventListener('click', () => {
    form.reset();
    selectJabatan.value = '';
    customJabatanGroup.style.display = 'none';
    inputCustomJabatan.value = '';

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
});

