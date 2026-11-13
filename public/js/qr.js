/**
 * Fullscreen QR Code Display for Projector - BBPOM di Pangkalpinang
 */

document.addEventListener('DOMContentLoaded', async () => {
  const qrImage = document.getElementById('projectorQrImage');
  const qrUrl = document.getElementById('projectorQrUrl');
  const signedCount = document.getElementById('qrSignedCount');
  const btnToggleFull = document.getElementById('btnToggleFullscreen');
  const btnCopy = document.getElementById('btnCopyUrl');

  const browserOrigin = window.location.origin;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  let currentUrl = `${browserOrigin}/sign`;

  try {
    const res = await fetch('/api/info');
    const info = await res.json();
    
    // When opened on Render or any public cloud domain, ALWAYS use the public URL
    // so participants on HP (cellular data or Wi-Fi) can open it directly!
    if (!isLocalhost) {
      currentUrl = `${browserOrigin}/sign`;
    } else if (info && info.mobileSignUrl) {
      currentUrl = info.mobileSignUrl;
    }
  } catch (err) {
    console.warn('Fallback to browser origin URL:', err);
    currentUrl = `${browserOrigin}/sign`;
  }

  qrUrl.textContent = currentUrl;
  qrImage.src = `/api/qr-image?url=${encodeURIComponent(currentUrl)}`;

  // Socket.IO for live participant count
  const socket = io();
  socket.on('initial_data', (payload) => {
    if (signedCount && payload.meta) {
      signedCount.textContent = payload.meta.total || 0;
    }
  });

  socket.on('new_signature', (payload) => {
    if (signedCount && payload.meta) {
      signedCount.textContent = payload.meta.total || 0;
    }
  });

  if (btnToggleFull) {
    btnToggleFull.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }

  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(currentUrl).then(() => {
        btnCopy.textContent = '✓ Tersalin!';
        setTimeout(() => btnCopy.textContent = 'Salin Link', 2000);
      });
    });
  }
});

