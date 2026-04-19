import { DownloadManager, DownloadRequest } from './DownloadManager';
import { ZipStreamingManager, ZipDownloadRequest } from './ZipStreamingManager';
import { stateStore } from './StateStore';

// ─── DOM refs ────────────────────────────────────────────────────────────────
function $<T extends HTMLElement>(id: string) { return document.getElementById(id) as T; }

const urlInput       = $<HTMLTextAreaElement>('url-input');
const urlCountEl     = $<HTMLSpanElement>('url-count');
const apiUrlInput    = $<HTMLInputElement>('api-url');
const fetchApiBtn    = $<HTMLButtonElement>('fetch-api-btn');
const goBtn          = $<HTMLButtonElement>('go-btn');
const toast          = $<HTMLDivElement>('toast');
const progressSec    = $<HTMLDivElement>('progress-section');
const step1          = $<HTMLDivElement>('step1');
const step2          = $<HTMLDivElement>('step2');

const progressFill   = $<HTMLDivElement>('progress-fill');
const barPct         = $<HTMLDivElement>('bar-pct');
const barLabel       = $<HTMLDivElement>('bar-label');
const statFiles      = $<HTMLDivElement>('stat-files');
const statSpeed      = $<HTMLDivElement>('stat-speed');
const statEta        = $<HTMLDivElement>('stat-eta');

const pauseBtn       = $<HTMLButtonElement>('pause-btn');
const resumeBtnDash  = $<HTMLButtonElement>('resume-btn-dash');
const zipNowBtn      = $<HTMLButtonElement>('zip-now-btn');
const folderBtn      = $<HTMLButtonElement>('folder-btn');
const resetBtn       = $<HTMLButtonElement>('reset-btn');
const fileList       = $<HTMLDivElement>('file-list');
const fileCount      = $<HTMLSpanElement>('file-count');
const compatNotice   = $<HTMLDivElement>('compat-notice');
const resumeBanner   = $<HTMLDivElement>('resume-banner');
const resumeBtn      = $<HTMLButtonElement>('resume-btn');
const dismissBtn     = $<HTMLButtonElement>('dismiss-btn');
const resumeSub      = $<HTMLElement>('resume-sub');

// ─── State ───────────────────────────────────────────────────────────────────
const manager = new DownloadManager();
let zipManager: ZipStreamingManager | null = null;
let currentRequests: DownloadRequest[] = [];
let speedSamples: number[] = [];
let lastBytes = 0;
let lastTime  = Date.now();

// ─── Browser compat check ────────────────────────────────────────────────────
const isNativeFS  = 'showDirectoryPicker' in window;
const isOPFS      = 'storage' in navigator && 'getDirectory' in navigator.storage;
if (!isNativeFS) {
  compatNotice.style.display = 'flex';
}

// ─── URL counter ─────────────────────────────────────────────────────────────
function parseUrls(): string[] {
  return urlInput.value
    .split(/[\n,]+/)
    .map(u => u.trim())
    .filter(u => u.startsWith('http'));
}

urlInput.addEventListener('input', () => {
  const urls = parseUrls();
  urlCountEl.textContent = `${urls.length} URL${urls.length !== 1 ? 's' : ''}`;
  urlCountEl.classList.toggle('has-urls', urls.length > 0);
  if (urls.length > 0) step2.classList.add('active');
});

// ─── Toast helper ────────────────────────────────────────────────────────────
function showToast(msg: string, type: 'info'|'error'|'success' = 'info') {
  toast.textContent = msg;
  toast.className   = `show ${type === 'default' ? '' : type}`;
  setTimeout(() => toast.classList.remove('show'), 6000);
}

// ─── Session hydration ────────────────────────────────────────────────────────
(async () => {
  try {
    const all = await stateStore.getAll();
    const pending = all.filter(f => f.status !== 'transferred');
    if (pending.length > 0) {
      resumeSub.textContent = `${pending.length} file${pending.length !== 1 ? 's' : ''} from last time are waiting`;
      resumeBanner.style.display = 'flex';
    }
  } catch { /* non-fatal */ }
})();

resumeBtn.addEventListener('click', async () => {
  resumeBanner.style.display = 'none';
  showToast('📂 Select your destination folder to continue…');
  await startDownloads(true);
});

dismissBtn.addEventListener('click', async () => {
  resumeBanner.style.display = 'none';
  await stateStore.clearAll();
});

// ─── Fetch from API ───────────────────────────────────────────────────────────
fetchApiBtn.addEventListener('click', async () => {
  const url = apiUrlInput.value.trim();
  if (!url) return;
  fetchApiBtn.disabled = true;
  fetchApiBtn.textContent = 'Fetching…';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    let urls: string[] = [];
    if (Array.isArray(data)) urls = data as string[];
    else if (data && typeof data === 'object' && 'presignedUrls' in data) {
      urls = (data as { presignedUrls: string[] }).presignedUrls;
    }
    urlInput.value = urls.join('\n');
    urlInput.dispatchEvent(new Event('input'));
    showToast(`✅ Loaded ${urls.length} URLs from API`, 'success');
  } catch (err: unknown) {
    showToast(`❌ Fetch failed: ${(err as Error).message}`, 'error');
  } finally {
    fetchApiBtn.disabled = false;
    fetchApiBtn.textContent = 'Fetch URLs';
  }
});

// ─── Main start ───────────────────────────────────────────────────────────────
declare const selectedMode: string;

goBtn.addEventListener('click', async () => {
  const urls = parseUrls();
  if (!urls.length) {
    showToast('⚠️ Paste at least one URL above', 'error');
    return;
  }

  if (selectedMode === 'zip') {
    await startZip(urls);
  } else {
    await startDownloads(false, urls);
  }
});

async function buildRequests(urls: string[]): Promise<DownloadRequest[]> {
  return urls.map(url => {
    const filename = extractFilename(url);
    const id = btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    return { id, url, fileName: filename, totalSize: 0 };
  });
}

async function startDownloads(resume = false, urls?: string[]) {
  showProgressSection();
  goBtn.disabled = true;

  try {
    if (!resume && urls) {
      currentRequests = await buildRequests(urls);
    } else {
      const stored = await stateStore.getAll();
      currentRequests = stored.map(f => ({
        id: f.id,
        url: f.url,
        fileName: f.fileName,
        totalSize: f.totalSize,
      }));
    }
    barLabel.textContent = 'Downloading…';
    await manager.startDownloads(currentRequests);
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name !== 'AbortError') showToast(`❌ ${e.message}`, 'error');
  } finally {
    goBtn.disabled = false;
  }
}

async function startZip(urls: string[]) {
  showProgressSection();
  goBtn.disabled = true;
  try {
    barLabel.textContent = 'Streaming ZIP…';
    const requests: ZipDownloadRequest[] = urls.map(url => ({
      url,
      fileName: extractFilename(url),
    }));
    zipManager = new ZipStreamingManager();
    await zipManager.streamArchive('dropstream-archive.zip', requests);
    barLabel.textContent = 'ZIP complete!';
    barPct.style.color = 'var(--green)';
    showToast('✅ ZIP download complete!', 'success');
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name !== 'AbortError') showToast(`❌ ZIP error: ${e.message}`, 'error');
  } finally {
    goBtn.disabled = false;
  }
}

// ─── Progress callback ────────────────────────────────────────────────────────
manager.onProgress = (stats) => {
  const pct = stats.totalBytes > 0
    ? Math.round((stats.downloadedBytes / stats.totalBytes) * 100)
    : 0;

  progressFill.style.width = `${pct}%`;
  barPct.textContent = `${pct}%`;
  statFiles.textContent = `${stats.completedFiles} / ${stats.totalFiles}`;

  // Speed calculation
  const now = Date.now();
  const dt  = (now - lastTime) / 1000;
  if (dt > 0.3) {
    const delta = stats.downloadedBytes - lastBytes;
    const bps   = delta / dt;
    speedSamples.push(bps);
    if (speedSamples.length > 6) speedSamples.shift();
    const avg = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
    statSpeed.textContent = formatSpeed(avg);
    const remaining = stats.totalBytes - stats.downloadedBytes;
    statEta.textContent = avg > 0 ? formatEta(remaining / avg) : '—';
    lastBytes = stats.downloadedBytes;
    lastTime  = now;
  }

  // Status label
  if (stats.transferredFiles === stats.totalFiles && stats.totalFiles > 0) {
    barLabel.textContent = '✅ All files complete!';
    barPct.style.color = 'var(--green)';
    showToast(`✅ ${stats.totalFiles} files downloaded!`, 'success');
  } else if (stats.stagedFiles > 0) {
    barLabel.textContent = `${stats.stagedFiles} file(s) staged, transferring to folder…`;
  } else {
    barLabel.textContent = `Downloading ${stats.activeFiles.length} file(s)…`;
  }

  renderFileList(stats);
};

// ─── Controls ─────────────────────────────────────────────────────────────────
pauseBtn.addEventListener('click', () => {
  manager.togglePause();
  if (manager.getPaused()) {
    pauseBtn.style.display = 'none';
    resumeBtnDash.style.display = '';
    barLabel.textContent = '⏸ Paused';
    showToast('⏸ Downloads paused');
  }
});
resumeBtnDash.addEventListener('click', () => {
  manager.togglePause();
  resumeBtnDash.style.display = 'none';
  pauseBtn.style.display = '';
  barLabel.textContent = 'Resuming…';
  showToast('▶ Resuming downloads…');
});

zipNowBtn.addEventListener('click', async () => {
  zipNowBtn.disabled = true;
  const stored = await stateStore.getAll();
  const reqs: ZipDownloadRequest[] = stored.map(f => ({
    url: f.url,
    fileName: f.fileName,
    opfsId: f.status === 'completed' ? f.id : undefined,
  }));
  try {
    showToast('🗜️ Streaming ZIP…');
    const zm = new ZipStreamingManager();
    await zm.streamArchive('dropstream-archive.zip', reqs);
    showToast('✅ ZIP ready!', 'success');
  } catch(e) {
    showToast('❌ ZIP failed', 'error');
  } finally {
    zipNowBtn.disabled = false;
  }
});

folderBtn.addEventListener('click', async () => {
  if (!isNativeFS) {
    showToast('⚠️ Your browser does not support folder saving. Use "Save as ZIP" instead.', 'error');
    return;
  }
  try {
    const handle = await (window as Window & { showDirectoryPicker: (o: unknown) => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker({ mode: 'readwrite' });
    manager.setDirectoryHandle(handle);
    showToast('📁 Folder selected — transferring files…');
  } catch(e: unknown) {
    const err = e as Error;
    if (err.name !== 'AbortError') showToast(`❌ ${err.message}`, 'error');
  }
});

resetBtn.addEventListener('click', async () => {
  await stateStore.clearAll();
  urlInput.value = '';
  urlInput.dispatchEvent(new Event('input'));
  currentRequests = [];
  speedSamples = [];
  lastBytes = 0;
  fileList.innerHTML = '';
  progressSec.classList.remove('visible');
  progressFill.style.width = '0%';
  barPct.textContent = '0%';
  barPct.style.color = '';
  barLabel.textContent = 'Starting…';
  step1.classList.remove('done');
  step2.classList.remove('done');
  step1.classList.add('active');
  showToast('↺ Reset complete');
});

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); pauseBtn.style.display !== 'none' ? pauseBtn.click() : resumeBtnDash.click(); }
  if (e.code === 'Escape') { manager.togglePause(); if (!manager.getPaused()) manager.togglePause(); showToast('Cancelled'); }
  if (e.code === 'KeyR') resetBtn.click();
});

// ─── File list rendering ──────────────────────────────────────────────────────
import { FileDownloadMetadata } from './StateStore';

interface ManagerProgressStats {
  totalFiles: number;
  completedFiles: number;
  stagedFiles: number;
  transferredFiles: number;
  totalBytes: number;
  downloadedBytes: number;
  activeFiles: string[];
  activeTransfers: string[];
}

function renderFileList(stats: ManagerProgressStats) {
  fileCount.textContent = `${stats.totalFiles} file${stats.totalFiles !== 1 ? 's' : ''}`;

  stateStore.getAll().then(files => {
    files.sort((a, b) => {
      const ord: Record<string, number> = { downloading: 0, completed: 1, transferred: 2, error: 3, pending: 4, paused: 5 };
      return (ord[a.status] ?? 9) - (ord[b.status] ?? 9);
    });

    const existIds = new Set(Array.from(fileList.children).map(el => (el as HTMLElement).dataset.id));

    files.forEach(file => {
      const pct = file.totalSize > 0
        ? Math.round((file.downloadedSize / file.totalSize) * 100)
        : file.status === 'transferred' ? 100 : 0;

      const dotClass = statusToDot(file.status);
      const badge    = statusToBadge(file.status);
      const meta     = buildMeta(file, pct);

      if (existIds.has(file.id)) {
        const row = fileList.querySelector(`[data-id="${file.id}"]`) as HTMLElement;
        if (row) {
          (row.querySelector('.file-dot') as HTMLElement).className = `file-dot ${dotClass}`;
          (row.querySelector('.file-sub-fill') as HTMLElement).style.width = `${pct}%`;
          (row.querySelector('.file-meta') as HTMLElement).textContent = meta;
          const b = row.querySelector('.file-status-text') as HTMLElement;
          b.className = `file-status-text ${badge.cls}`;
          b.textContent = badge.label;
        }
        existIds.delete(file.id);
      } else {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.dataset.id = file.id;
        row.setAttribute('role', 'listitem');
        row.innerHTML = `
          <div class="file-dot ${dotClass}"></div>
          <div class="file-info">
            <div class="file-name" title="${esc(file.url)}">${esc(file.fileName)}</div>
            <div class="file-meta">${meta}</div>
            <div class="file-sub-bar"><div class="file-sub-fill" style="width:${pct}%"></div></div>
          </div>
          <span class="file-status-text ${badge.cls}">${badge.label}</span>
        `;
        fileList.appendChild(row);
      }
    });

    existIds.forEach(id => fileList.querySelector(`[data-id="${id}"]`)?.remove());
  });
}

function statusToDot(s: string): string {
  const m: Record<string,string> = { downloading:'downloading', completed:'staged', transferred:'done', paused:'paused', error:'error', pending:'queued' };
  return m[s] ?? '';
}

function statusToBadge(s: string): { cls: string; label: string } {
  const m: Record<string, { cls: string; label: string }> = {
    pending:     { cls: 'st-queued',     label: 'Queued'      },
    downloading: { cls: 'st-downloading',label: 'Downloading' },
    completed:   { cls: 'st-staged',     label: 'Staged'      },
    transferred: { cls: 'st-done',       label: '✓ Done'      },
    paused:      { cls: 'st-paused',     label: 'Paused'      },
    error:       { cls: 'st-error',      label: 'Error'       },
  };
  return m[s] ?? { cls: 'st-queued', label: s };
}

function buildMeta(f: FileDownloadMetadata, pct: number): string {
  const parts: string[] = [];
  if (f.totalSize > 0) parts.push(`${fmtBytes(f.downloadedSize)} / ${fmtBytes(f.totalSize)}`);
  if (f.status === 'downloading') parts.push(`${pct}%`);
  if (f.errorMessage) parts.push(f.errorMessage);
  return parts.join(' · ') || ' ';
}

// ─── UI transitions ───────────────────────────────────────────────────────────
function showProgressSection() {
  step1.classList.remove('active'); step1.classList.add('done');
  step2.classList.remove('active'); step2.classList.add('done');
  progressSec.classList.add('visible');
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function extractFilename(url: string): string {
  try {
    const p = new URL(url).pathname;
    const parts = p.split('/').filter(Boolean);
    const last  = parts[parts.length - 1];
    return last && last.includes('.') ? decodeURIComponent(last) : `file-${Date.now()}`;
  } catch { return `file-${Date.now()}`; }
}

function fmtBytes(b: number): string {
  if (!b) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / k**i).toFixed(1)} ${s[i]}`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024)       return `${bps.toFixed(0)} B/s`;
  if (bps < 1024**2)    return `${(bps/1024).toFixed(1)} KB/s`;
  return `${(bps/1024**2).toFixed(2)} MB/s`;
}

function formatEta(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '—';
  if (sec < 60)   return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec/60)}m`;
  return `${Math.floor(sec/3600)}h ${Math.round((sec%3600)/60)}m`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
}
