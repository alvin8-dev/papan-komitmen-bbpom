const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const ws = require('ws');
global.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');

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

// Supabase configuration (Persistent Database)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    console.log('[Supabase] Database client initialized successfully.');
  } catch (err) {
    console.error('[Supabase] Failed to initialize Supabase client:', err.message);
  }
} else {
  console.log('[Storage] Supabase env not set. Using local signatures.json storage mode.');
}

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

// Helper to sync latest data from Supabase
async function syncSignaturesFromSupabase() {
  if (!supabase) return signaturesData;
  try {
    const { data, error } = await supabase
      .from('signatures')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Supabase] Error fetching signatures:', error.message);
      return signaturesData;
    }

    // Auto-migrate: If Supabase table is empty but local storage has data, populate Supabase!
    if ((!data || data.length === 0) && signaturesData) {
      const localRows = [];
      if (signaturesData.kepala) localRows.push(signaturesData.kepala);
      if (signaturesData.kabag_tu) localRows.push(signaturesData.kabag_tu);
      if (Array.isArray(signaturesData.pegawai)) localRows.push(...signaturesData.pegawai);

      if (localRows.length > 0) {
        console.log(`[Supabase] Auto-migrating ${localRows.length} local signatures into Supabase...`);
        const payload = localRows.map(r => ({
          id: r.id,
          name: r.name,
          nip: r.nip || '-',
          jabatan: r.jabatan || '',
          role_type: r.roleType || 'PEGAWAI',
          signature_data_url: r.signatureDataUrl,
          created_at: r.createdAt || new Date().toISOString(),
          timestamp_formatted: r.timestampFormatted || ''
        }));
        const { error: migErr } = await supabase.from('signatures').upsert(payload, { onConflict: 'id' });
        if (migErr) {
          console.error('[Supabase] Failed auto-migrating to Supabase:', migErr.message);
        } else {
          console.log(`[Supabase] Successfully auto-migrated ${localRows.length} signatures to Supabase!`);
        }
        return signaturesData;
      }
    }

    let kepala = null;
    let kabag_tu = null;
    const pegawai = [];
    const history = [];

    if (Array.isArray(data) && data.length > 0) {
      for (const row of data) {
        const item = {
          id: row.id,
          name: row.name,
          nip: row.nip || '-',
          jabatan: row.jabatan || '',
          roleType: row.role_type || 'PEGAWAI',
          signatureDataUrl: row.signature_data_url,
          createdAt: row.created_at,
          timestampFormatted: row.timestamp_formatted || ''
        };
        history.push(item);

        if (item.roleType === 'KEPALA') {
          kepala = item;
        } else if (item.roleType === 'KABAG_TU') {
          kabag_tu = item;
        } else {
          const existingIdx = pegawai.findIndex(
            p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (existingIdx !== -1) {
            pegawai[existingIdx] = item;
          } else {
            pegawai.push(item);
          }
        }
      }

      signaturesData = {
        kepala,
        kabag_tu,
        pegawai,
        history
      };

      // Mirror to local JSON as fallback
      saveSignatures(signaturesData);
    }

    return signaturesData;
  } catch (err) {
    console.error('[Supabase] Unexpected error syncing data:', err);
    return signaturesData;
  }
}

// Initial sync on server boot
if (supabase) {
  syncSignaturesFromSupabase().then(() => {
    const count = (signaturesData.kepala ? 1 : 0) + (signaturesData.kabag_tu ? 1 : 0) + signaturesData.pegawai.length;
    console.log(`[Supabase] Initial sync complete. Loaded ${count} signatures.`);
  });
}

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

// Classify role based on jabatan string and/or person name
function determineRoleType(jabatan = '', name = '') {
  const cleanJabatan = (jabatan || '').trim().toLowerCase();
  const cleanName = (name || '').trim().toLowerCase();
  
  // Kepala Balai check (by official name or official role)
  const isKepala = cleanName.includes('alex sander') ||
                  cleanJabatan.includes('kepala balai besar') || 
                  cleanJabatan.includes('kepala bbpom') ||
                  (cleanJabatan.startsWith('kepala balai') && !cleanJabatan.includes('bagian') && !cleanJabatan.includes('tu')) ||
                  cleanJabatan === 'kepala balai besar pom di pangkal pinang' ||
                  cleanJabatan === 'kepala balai besar pom di pangkalpinang';

  if (isKepala) {
    return 'KEPALA';
  }

  // Kabag TU check (by official name or official role)
  const isKabagTU = cleanName.includes('mardianto') ||
                    cleanJabatan.includes('kabag tu') ||
                    cleanJabatan.includes('kabag tata usaha') ||
                    (cleanJabatan.includes('tata usaha') && cleanJabatan.includes('kepala bagian')) ||
                    cleanJabatan.includes('kepala bagian tu') ||
                    cleanJabatan === 'kabag tu balai besar pom di pangkal pinang' ||
                    cleanJabatan === 'kepala bagian tata usaha balai besar pom di pangkal pinang';

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

// 3. API - Server & Network Info (Supports Localhost, Wi-Fi LAN, and Cloud Platforms like Render)
app.get('/api/info', async (req, res) => {
  const localIP = getLocalNetworkIP();
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host') || '';
  
  // Check if running on Render / Cloud public domain
  const isCloudHost = !!(
    process.env.RENDER || 
    process.env.RENDER_EXTERNAL_URL || 
    (host && !host.includes('localhost') && !host.includes('127.0.0.1') && !host.startsWith('192.168.') && !host.startsWith('172.16.'))
  );

  let mobileSignUrl = '';
  if (process.env.RENDER_EXTERNAL_URL) {
    const renderUrl = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
    mobileSignUrl = `${renderUrl}/sign`;
  } else if (isCloudHost && host) {
    mobileSignUrl = `${protocol}://${host}/sign`;
  } else {
    // Local development on Wi-Fi
    mobileSignUrl = `http://${localIP}:${PORT}/sign`;
  }

  res.json({
    localIP,
    port: PORT,
    isCloudHost,
    mobileSignUrl,
    currentSignUrl: `${protocol}://${host}/sign`,
    timestamp: new Date().toISOString()
  });
});

// 3b. API - Get Nominatif Pegawai List from Excel/JSON
app.get('/api/pegawai', (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'pegawai_nominatif.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return res.json({ success: true, count: data.length, data });
    }
    return res.json({ success: true, count: 0, data: [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal membaca data pegawai nominatif.', error: err.message });
  }
});

// 4. API - Dynamic QR Code Generator for mobile URL
app.get('/api/qr-image', async (req, res) => {
  try {
    const localIP = getLocalNetworkIP();
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host') || '';
    
    let defaultUrl = '';
    if (process.env.RENDER_EXTERNAL_URL) {
      defaultUrl = `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/sign`;
    } else if (host && !host.includes('localhost') && !host.includes('127.0.0.1') && !host.startsWith('192.168.') && !host.startsWith('172.16.')) {
      defaultUrl = `${protocol}://${host}/sign`;
    } else {
      defaultUrl = `http://${localIP}:${PORT}/sign`;
    }

    const targetUrl = req.query.url || defaultUrl;
    
    res.setHeader('Content-Type', 'image/png');
    QRCode.toFileStream(res, targetUrl, {
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

// 4b. Diagnostic API - Check Supabase Connection & Table Status
app.get('/api/db-status', async (req, res) => {
  if (!supabase) {
    return res.json({
      connected: false,
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SUPABASE_KEY,
      keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.substring(0, 15) : '',
      keyLength: SUPABASE_KEY ? SUPABASE_KEY.length : 0,
      message: 'Supabase client is not initialized.'
    });
  }
  try {
    const { data, error, count } = await supabase.from('signatures').select('*', { count: 'exact' });
    if (error) {
      return res.json({
        connected: false,
        keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.substring(0, 15) : '',
        keyLength: SUPABASE_KEY ? SUPABASE_KEY.length : 0,
        error: { message: error.message, details: error.details, hint: error.hint, code: error.code }
      });
    }
    return res.json({
      connected: true,
      keyPrefix: SUPABASE_KEY ? SUPABASE_KEY.substring(0, 15) : '',
      count: data ? data.length : 0,
      records: (data || []).map(r => ({ id: r.id, name: r.name, role: r.role_type }))
    });
  } catch (err) {
    return res.status(500).json({ connected: false, error: err.message, stack: err.stack });
  }
});

// 4c. Diagnostic API - Manually push all current local signatures to Supabase
app.get('/api/migrate-to-supabase', async (req, res) => {
  if (!supabase) {
    return res.status(400).json({ success: false, message: 'Supabase not configured' });
  }
  try {
    const localRows = [];
    if (signaturesData.kepala) localRows.push(signaturesData.kepala);
    if (signaturesData.kabag_tu) localRows.push(signaturesData.kabag_tu);
    if (Array.isArray(signaturesData.pegawai)) localRows.push(...signaturesData.pegawai);

    const payload = localRows.map(r => ({
      id: r.id,
      name: r.name,
      nip: r.nip || '-',
      jabatan: r.jabatan || '',
      role_type: r.roleType || 'PEGAWAI',
      signature_data_url: r.signatureDataUrl,
      created_at: r.createdAt || new Date().toISOString(),
      timestamp_formatted: r.timestampFormatted || ''
    }));

    const { data, error } = await supabase.from('signatures').upsert(payload, { onConflict: 'id' });
    if (error) {
      return res.status(500).json({ success: false, error });
    }
    return res.json({ success: true, count: payload.length, message: `Migrated ${payload.length} signatures to Supabase` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. API - GET all signatures
app.get('/api/signatures', async (req, res) => {
  if (supabase) {
    await syncSignaturesFromSupabase();
  } else {
    signaturesData = loadSignatures();
  }
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
      storageMode: supabase ? 'supabase' : 'local_json',
      updatedAt: new Date().toISOString()
    }
  });
});

// 6. API - POST submit new signature
app.post('/api/signatures', async (req, res) => {
  try {
    const { name, nip, jabatan, signatureDataUrl } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama lengkap beserta gelar wajib diisi.' });
    }
    if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ success: false, message: 'Tanda tangan digital wajib digambar.' });
    }

    const trimmedName = name.trim();
    let trimmedNip = (nip || '').trim();
    let trimmedJabatan = (jabatan || '').trim();
    const roleType = determineRoleType(trimmedJabatan, trimmedName);

    // Auto-fill official NIP & Jabatan for Leadership if omitted
    if (roleType === 'KEPALA') {
      trimmedNip = trimmedNip && trimmedNip !== '-' ? trimmedNip : '19791212 200604 1 005';
      trimmedJabatan = trimmedJabatan && trimmedJabatan !== '-' ? trimmedJabatan : 'Kepala Balai Besar POM di Pangkal Pinang';
    } else if (roleType === 'KABAG_TU') {
      trimmedNip = trimmedNip && trimmedNip !== '-' ? trimmedNip : '19830326 200812 1 001';
      trimmedJabatan = trimmedJabatan && trimmedJabatan !== '-' ? trimmedJabatan : 'Kepala Bagian Tata Usaha Balai Besar POM di Pangkal Pinang';
    } else {
      trimmedNip = trimmedNip || '-';
      trimmedJabatan = trimmedJabatan || '';
    }

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

    // Store in-memory based on roleType
    if (roleType === 'KEPALA') {
      signaturesData.kepala = newRecord;
    } else if (roleType === 'KABAG_TU') {
      signaturesData.kabag_tu = newRecord;
    } else {
      // If employee with same name already signed, update their signature; otherwise push new
      const existingIdx = signaturesData.pegawai.findIndex(
        p => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (existingIdx !== -1) {
        signaturesData.pegawai[existingIdx] = newRecord;
      } else {
        signaturesData.pegawai.push(newRecord);
      }
    }

    // Keep in full audit history
    signaturesData.history.push(newRecord);

    // Save to local JSON backup
    saveSignatures(signaturesData);

    // Save to Supabase (if connected)
    if (supabase) {
      try {
        if (roleType === 'KEPALA') {
          await supabase.from('signatures').delete().eq('role_type', 'KEPALA');
        } else if (roleType === 'KABAG_TU') {
          await supabase.from('signatures').delete().eq('role_type', 'KABAG_TU');
        } else {
          await supabase.from('signatures').delete().ilike('name', trimmedName);
        }

        const { error: insertErr } = await supabase.from('signatures').insert({
          id: newRecord.id,
          name: newRecord.name,
          nip: newRecord.nip,
          jabatan: newRecord.jabatan,
          role_type: newRecord.roleType,
          signature_data_url: newRecord.signatureDataUrl,
          created_at: newRecord.createdAt,
          timestamp_formatted: newRecord.timestampFormatted
        });

        if (insertErr) {
          console.error('[Supabase] Gagal menyimpan data ke tabel signatures:', insertErr.message);
        } else {
          console.log(`[Supabase] Sukses menyimpan tanda tangan: ${newRecord.name} (${newRecord.roleType})`);
        }
      } catch (dbErr) {
        console.error('[Supabase] Exception saat menyimpan data:', dbErr.message);
      }
    }

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
app.delete('/api/signatures/:id', async (req, res) => {
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

    if (supabase) {
      try {
        await supabase.from('signatures').delete().eq('id', id);
        console.log(`[Supabase] Tanda tangan id ${id} berhasil dihapus dari cloud.`);
      } catch (dbErr) {
        console.error('[Supabase] Exception saat hapus id:', dbErr.message);
      }
    }

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
app.post('/api/reset', async (req, res) => {
  signaturesData = getInitialData();
  saveSignatures(signaturesData);

  if (supabase) {
    try {
      await supabase.from('signatures').delete().neq('id', '___dummy_never_match___');
      console.log('[Supabase] Seluruh data tanda tangan di cloud berhasil direset.');
    } catch (dbErr) {
      console.error('[Supabase] Exception saat reset tabel:', dbErr.message);
    }
  }

  io.emit('data_reset', { success: true });
  res.json({ success: true, message: 'Seluruh tanda tangan telah direset.' });
});

// 9. API - Seed Realistic Sample Data (for Demo & Practice)
app.post('/api/seed', async (req, res) => {
  function makeSvgSig(pathD, strokeColor = '#002b5b') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80"><path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  const sampleKepala = {
    id: 'sig_kepala_demo',
    name: 'Alex Sander, S.Farm., Apt., M.H',
    nip: '19791212 200604 1 005',
    jabatan: 'Kepala Balai Besar POM di Pangkal Pinang',
    roleType: 'KEPALA',
    signatureDataUrl: makeSvgSig('M 25 58 C 40 15, 65 20, 80 50 C 95 35, 115 25, 130 52 C 145 35, 175 30, 205 45 M 35 62 L 215 58'),
    createdAt: new Date().toISOString(),
    timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  };

  const sampleKabagTU = {
    id: 'sig_kabag_demo',
    name: 'Mardianto, S.Farm., Apt.',
    nip: '19830326 200812 1 001',
    jabatan: 'Kepala Bagian Tata Usaha Balai Besar POM di Pangkal Pinang',
    roleType: 'KABAG_TU',
    signatureDataUrl: makeSvgSig('M 30 65 Q 45 10, 60 55 T 100 50 Q 130 20, 160 55 T 210 40 M 45 68 Q 120 72, 205 60'),
    createdAt: new Date().toISOString(),
    timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  };

  const samplePegawai = [
    {
      id: 'sig_peg_1',
      name: 'Ria Emeilia, S.Farm., Apt.',
      nip: '-',
      jabatan: 'Ketua Tim Kerja Pengujian',
      roleType: 'PEGAWAI',
      signatureDataUrl: makeSvgSig('M 25 55 Q 50 15, 80 45 Q 110 30, 140 50 T 200 45 M 35 60 L 195 56'),
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    },
    {
      id: 'sig_peg_2',
      name: 'Welinda Syafri, S.Farm., Apt.',
      nip: '-',
      jabatan: 'Ketua Tim Kerja Pemeriksaan',
      roleType: 'PEGAWAI',
      signatureDataUrl: makeSvgSig('M 30 60 C 50 20, 70 30, 90 55 C 110 40, 130 35, 160 50 C 180 35, 195 40, 215 45 M 30 65 L 210 60'),
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    },
    {
      id: 'sig_peg_3',
      name: 'Tri Astuti Rahmawati, S.TP., M.Sc.',
      nip: '-',
      jabatan: 'Ketua Tim Kerja Penindakan',
      roleType: 'PEGAWAI',
      signatureDataUrl: makeSvgSig('M 25 65 Q 40 18, 65 52 T 115 48 Q 145 25, 175 52 T 215 42 M 35 68 L 210 63'),
      createdAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    },
    {
      id: 'sig_peg_4',
      name: 'Sony Lawrensia, S.Farm., Apt.',
      nip: '-',
      jabatan: 'Ketua Tim Kerja Informasi dan Komunikasi',
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

  if (supabase) {
    try {
      await supabase.from('signatures').delete().neq('id', '___dummy_never_match___');
      const allRows = [sampleKepala, sampleKabagTU, ...samplePegawai].map(item => ({
        id: item.id,
        name: item.name,
        nip: item.nip,
        jabatan: item.jabatan,
        role_type: item.roleType,
        signature_data_url: item.signatureDataUrl,
        created_at: item.createdAt,
        timestamp_formatted: item.timestampFormatted
      }));
      await supabase.from('signatures').insert(allRows);
    } catch (dbErr) {
      console.error('[Supabase] Exception saat seeding Supabase:', dbErr.message);
    }
  }

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
io.on('connection', async (socket) => {
  if (supabase) {
    await syncSignaturesFromSupabase();
  } else {
    signaturesData = loadSignatures();
  }
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
