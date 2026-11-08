const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'signatures.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data folder and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialData() {
  return {
    kepala: null,
    kabag_tu: null,
    pegawai: [],
    history: []
  };
}

function loadSignatures() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        kepala: parsed.kepala || null,
        kabag_tu: parsed.kabag_tu || null,
        pegawai: Array.isArray(parsed.pegawai) ? parsed.pegawai : [],
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    }
  } catch (err) {
    console.error('Error reading signatures data:', err);
  }
  return getInitialData();
}

function saveSignatures(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving signatures data:', err);
    return false;
  }
}

// In-memory cache
let signaturesData = loadSignatures();

// Helper to determine network IP
function getLocalNetworkIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Classify role based on jabatan string
function determineRoleType(jabatan = '') {
  const clean = jabatan.trim().toLowerCase();
  
  // Kepala Balai check
  const isKepala = clean.includes('kepala balai besar') || 
                  clean.includes('kepala bbpom') ||
                  (clean.startsWith('kepala balai') && !clean.includes('bagian') && !clean.includes('tu')) ||
                  clean === 'kepala balai besar pom di pangkal pinang' ||
                  clean === 'kepala balai besar pom di pangkalpinang';

  if (isKepala) {
    return 'KEPALA';
  }

  // Kabag TU check
  const isKabagTU = clean.includes('kabag tu') ||
                    clean.includes('kabag tata usaha') ||
                    (clean.includes('tata usaha') && clean.includes('kepala bagian')) ||
                    clean.includes('kepala bagian tu') ||
                    clean === 'kabag tu balai besar pom di pangkal pinang' ||
                    clean === 'kepala bagian tata usaha balai besar pom di pangkal pinang';

  if (isKabagTU) {
    return 'KABAG_TU';
  }

  return 'PEGAWAI';
}

// Routes
// 1. Participant Input Page
app.get('/sign', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sign.html'));
});

// 2. Fullscreen QR Code Display
app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'qr.html'));
});

// 3. API - Server & Network Info
app.get('/api/info', async (req, res) => {
  const localIP = getLocalNetworkIP();
  const protocol = req.protocol;
  const host = req.get('host');
  
  // Best URL for mobile scanning on the same Wi-Fi
  const mobileSignUrl = `http://${localIP}:${PORT}/sign`;
  const currentSignUrl = `${protocol}://${host}/sign`;

  res.json({
    localIP,
    port: PORT,
    mobileSignUrl,
    currentSignUrl,
    timestamp: new Date().toISOString()
  });
});

// 4. API - Dynamic QR Code Generator for mobile URL
app.get('/api/qr-image', async (req, res) => {
  try {
    const localIP = getLocalNetworkIP();
    const targetUrl = req.query.url || `http://${localIP}:${PORT}/sign`;
    
    res.setHeader('Content-Type', 'image/png');
    const qrStream = QRCode.toFileStream(res, targetUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      quality: 0.95,
      margin: 2,
      width: 400,
      color: {
        dark: '#00264d',
        light: '#ffffff'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code', details: err.message });
  }
});

// 5. API - GET all signatures
app.get('/api/signatures', (req, res) => {
  const totalCount = (signaturesData.kepala ? 1 : 0) +
                     (signaturesData.kabag_tu ? 1 : 0) +
                     signaturesData.pegawai.length;

  res.json({
    success: true,
    data: {
      kepala: signaturesData.kepala,
      kabag_tu: signaturesData.kabag_tu,
      pegawai: signaturesData.pegawai
    },
    meta: {
      total: totalCount,
      kepalaSigned: !!signaturesData.kepala,
      kabagTuSigned: !!signaturesData.kabag_tu,
      pegawaiCount: signaturesData.pegawai.length,
      updatedAt: new Date().toISOString()
    }
  });
});

// 6. API - POST submit new signature
app.post('/api/signatures', (req, res) => {
  try {
    const { name, nip, jabatan, signatureDataUrl } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama lengkap beserta gelar wajib diisi.' });
    }
    if (!nip || !nip.trim()) {
      return res.status(400).json({ success: false, message: 'NIP wajib diisi.' });
    }
    if (!jabatan || !jabatan.trim()) {
      return res.status(400).json({ success: false, message: 'Jabatan wajib diisi.' });
    }
    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Tanda tangan digital wajib digambar.' });
    }

    const trimmedName = name.trim();
    const trimmedNip = nip.trim();
    const trimmedJabatan = jabatan.trim();
    const roleType = determineRoleType(trimmedJabatan);

    const newRecord = {
      id: 'sig_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: trimmedName,
      nip: trimmedNip,
      jabatan: trimmedJabatan,
      roleType,
      signatureDataUrl,
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    // Store based on roleType
    if (roleType === 'KEPALA') {
      signaturesData.kepala = newRecord;
    } else if (roleType === 'KABAG_TU') {
      signaturesData.kabag_tu = newRecord;
    } else {
      signaturesData.pegawai.push(newRecord);
    }

    // Keep in full audit history
    signaturesData.history.push(newRecord);

    // Save to file
    saveSignatures(signaturesData);

    // Calculate metadata
    const totalCount = (signaturesData.kepala ? 1 : 0) +
                       (signaturesData.kabag_tu ? 1 : 0) +
                       signaturesData.pegawai.length;

    const payload = {
      record: newRecord,
      state: {
        kepala: signaturesData.kepala,
        kabag_tu: signaturesData.kabag_tu,
        pegawai: signaturesData.pegawai
      },
      meta: {
        total: totalCount,
        kepalaSigned: !!signaturesData.kepala,
        kabagTuSigned: !!signaturesData.kabag_tu,
        pegawaiCount: signaturesData.pegawai.length
      }
    };

    // Broadcast in real-time via Socket.IO
    io.emit('new_signature', payload);

    return res.status(201).json({
      success: true,
      message: 'Tanda tangan komitmen berhasil disimpan.',
      data: newRecord
    });
  } catch (err) {
    console.error('Error handling signature submission:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.', error: err.message });
  }
});

// 7. API - Delete single signature (Admin / Correction)
app.delete('/api/signatures/:id', (req, res) => {
  const { id } = req.params;
  let deleted = false;

  if (signaturesData.kepala && signaturesData.kepala.id === id) {
    signaturesData.kepala = null;
    deleted = true;
  } else if (signaturesData.kabag_tu && signaturesData.kabag_tu.id === id) {
    signaturesData.kabag_tu = null;
    deleted = true;
  } else {
    const idx = signaturesData.pegawai.findIndex(p => p.id === id);
    if (idx !== -1) {
      signaturesData.pegawai.splice(idx, 1);
      deleted = true;
    }
  }

  if (deleted) {
    saveSignatures(signaturesData);
    io.emit('signature_deleted', {
      deletedId: id,
      state: {
        kepala: signaturesData.kepala,
        kabag_tu: signaturesData.kabag_tu,
        pegawai: signaturesData.pegawai
      }
    });
    return res.json({ success: true, message: 'Data tanda tangan berhasil dihapus.' });
  }

  return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
});

// 8. API - Reset all signatures (for new event)
app.post('/api/reset', (req, res) => {
  signaturesData = getInitialData();
  saveSignatures(signaturesData);
  io.emit('data_reset', { success: true });
  res.json({ success: true, message: 'Seluruh tanda tangan telah direset.' });
});

// 9. API - Seed Realistic Sample Data (for Demo & Practice)
app.post('/api/seed', (req, res) => {
  function makeSvgSig(pathD, strokeColor = '#002b5b') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80"><path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  const sampleKepala = {
    id: 'sig_kepala_demo',
    name: 'Dra. Hermini, Apt., M.Kes.',
    nip: '19680715 199403 2 001',
    jabatan: 'Kepala Balai Besar POM di Pangkal Pinang',
    roleType: 'KEPALA',
    signatureDataUrl: makeSvgSig('M 25 58 C 40 15, 65 20, 80 50 C 95 35, 115 25, 130 52 C 145 35, 175 30, 205 45 M 35 62 L 215 58'),
    createdAt: new Date().toISOString(),
    timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  };

  const sampleKabagTU = {
    id: 'sig_kabag_demo',
    name: 'Budi Santoso, S.Farm., Apt.',
    nip: '19750912 200003 1 002',
    jabatan: 'Kabag TU Balai Besar POM di Pangkal Pinang',
    roleType: 'KABAG_TU',
    signatureDataUrl: makeSvgSig('M 30 65 Q 45 10, 60 55 T 100 50 Q 130 20, 160 55 T 210 40 M 45 68 Q 120 72, 205 60'),
    createdAt: new Date().toISOString(),
    timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  };

  const samplePegawai = [
    {
      id: 'sig_peg_1',
      name: 'Rina Astuti, S.Si., Apt.',
      nip: '19840321 200912 2 003',
      jabatan: 'Ketua Tim Kerja Pengujian',
      roleType: 'PEGAWAI',
      signatureDataUrl: makeSvgSig('M 25 55 Q 50 15, 80 45 Q 110 30, 140 50 T 200 45 M 35 60 L 195 56'),
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    },
    {
      id: 'sig_peg_2',
      name: 'Ahmad Fauzi, S.Farm.',
      nip: '19901104 201503 1 004',
      jabatan: 'Pengawas Farmasi dan Makanan Ahli Muda',
      roleType: 'PEGAWAI',
      signatureDataUrl: makeSvgSig('M 30 60 C 50 20, 70 30, 90 55 C 110 40, 130 35, 160 50 C 180 35, 195 40, 215 45 M 30 65 L 210 60'),
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    },
    {
      id: 'sig_peg_3',
      name: 'Dewi Lestari, S.Farm., Apt.',
      nip: '19880520 201212 2 002',
      jabatan: 'Ketua Tim Kerja Pemeriksaan',
      roleType: 'PEGAWAI',
      signatureDataUrl: makeSvgSig('M 25 65 Q 40 18, 65 52 T 115 48 Q 145 25, 175 52 T 215 42 M 35 68 L 210 63'),
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    },
    {
      id: 'sig_peg_4',
      name: 'Hendri Kurniawan, A.Md.',
      nip: '19950814 201801 1 001',
      jabatan: 'Pranata Laboratorium Pengujian',
      roleType: 'PEGAWAI',
      signatureDataUrl: makeSvgSig('M 28 62 C 45 22, 70 30, 95 58 C 120 42, 140 38, 170 52 M 30 68 L 190 62'),
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ];

  signaturesData = {
    kepala: sampleKepala,
    kabag_tu: sampleKabagTU,
    pegawai: samplePegawai,
    history: [sampleKepala, sampleKabagTU, ...samplePegawai]
  };

  saveSignatures(signaturesData);

  const payload = {
    state: {
      kepala: signaturesData.kepala,
      kabag_tu: signaturesData.kabag_tu,
      pegawai: signaturesData.pegawai
    },
    meta: {
      total: 6,
      kepalaSigned: true,
      kabagTuSigned: true,
      pegawaiCount: 4
    }
  };

  io.emit('initial_data', {
    kepala: signaturesData.kepala,
    kabag_tu: signaturesData.kabag_tu,
    pegawai: signaturesData.pegawai,
    meta: payload.meta
  });

  res.json({ success: true, message: 'Data contoh berhasil dimuat.', meta: payload.meta });
});

// Socket.IO events
io.on('connection', (socket) => {
  // Send current state immediately on connect
  socket.emit('initial_data', {
    kepala: signaturesData.kepala,
    kabag_tu: signaturesData.kabag_tu,
    pegawai: signaturesData.pegawai,
    meta: {
      total: (signaturesData.kepala ? 1 : 0) + (signaturesData.kabag_tu ? 1 : 0) + signaturesData.pegawai.length,
      kepalaSigned: !!signaturesData.kepala,
      kabagTuSigned: !!signaturesData.kabag_tu,
      pegawaiCount: signaturesData.pegawai.length
    }
  });

  socket.on('disconnect', () => {
    // Client disconnected
  });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalNetworkIP();
  console.log('================================================================');
  console.log(' PENCANANGAN ZONA INTEGRITAS MENUJU WBBM');
  console.log(' BALAI BESAR PENGAWAS OBAT DAN MAKANAN DI PANGKALPINANG');
  console.log('================================================================');
  console.log(`[Dashboard Piagam]  : http://localhost:${PORT}`);
  console.log(`[Input Peserta]     : http://localhost:${PORT}/sign`);
  console.log(`[Layar QR Code]     : http://localhost:${PORT}/qr`);
  console.log('----------------------------------------------------------------');
  console.log(`[Akses Jaringan Wi-Fi/HP Peserta]:`);
  console.log(`[Dashboard] : http://${localIP}:${PORT}`);
  console.log(`[Input HP]  : http://${localIP}:${PORT}/sign`);
  console.log(`[Layar QR]  : http://${localIP}:${PORT}/qr`);
  console.log('================================================================');
});
