const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export function getToken() {
  return localStorage.getItem('ftth_snd_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('ftth_snd_token', token);
  } else {
    localStorage.removeItem('ftth_snd_token');
  }
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const err = new Error(data?.message || `Error ${response.status}`);
    err.status = response.status;
    err.code = data?.code;
    err.data = data;
    err.invoice = data?.invoice;
    err.merchant = data?.merchant;
    err.user = data?.user;
    throw err;
  }

  return data;
}

export async function downloadExcelFile(endpoint, fallbackFilename) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let errMsg = 'Gagal mengunduh file Excel.';
    let errCode = '';
    try {
      const errJson = await response.json();
      errMsg = errJson.message || errMsg;
      errCode = errJson.code || '';
    } catch {
      // ignore
    }
    const err = new Error(errMsg);
    err.code = errCode;
    throw err;
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  let filename = fallbackFilename;
  const match = disposition.match(/filename="?([^"]+)"?/);
  if (match && match[1]) {
    filename = decodeURIComponent(match[1]);
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export const downloadBinaryFile = downloadExcelFile;
