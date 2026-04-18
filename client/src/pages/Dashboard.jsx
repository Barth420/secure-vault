import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { encryptFile, decryptFile, downloadBlob, bufferToBase64 } from '../utils/crypto';
import { fetchSyncStatus } from '../utils/sync';
import FileList    from '../components/FileList';
import UploadZone  from '../components/UploadZone';
import ShareModal  from '../components/ShareModal';
import ActivityLog from '../components/ActivityLog';
import SyncStatus  from '../components/SyncStatus';

export default function Dashboard() {
  const { user, logout, getMasterKey } = useAuth();
  const [files,       setFiles]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [activeTab,   setActiveTab]   = useState('files'); // files | activity
  const [syncStatus,  setSyncStatus]  = useState(null);
  const [toast,       setToast]       = useState(null);

  // ── Load file list ──────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const { data } = await api.get('/files/list');
      setFiles(data.files);
    } catch (err) {
      showToast('Failed to load files', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
    fetchSyncStatus().then(setSyncStatus).catch(() => {});
  }, [loadFiles]);

  // ── Toast helper ─────────────────────────────────────────
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Upload Handler ────────────────────────────────────────
  const handleUpload = async (fileList) => {
    const masterKey = getMasterKey();
    if (!masterKey) return showToast('Session expired. Please log in again.', 'error');

    setUploading(true);
    let successCount = 0;

    for (const file of fileList) {
      try {
        const buffer = await file.arrayBuffer();
        const { ciphertext, iv, encryptedKey, keyIv } = await encryptFile(buffer, masterKey);

        const formData = new FormData();
        formData.append('file', new Blob([ciphertext]), file.name);
        formData.append('filename',     file.name);
        formData.append('mimeType',     file.type || 'application/octet-stream');
        formData.append('iv',           iv);
        formData.append('encryptedKey', encryptedKey);
        formData.append('keyIv',        keyIv);

        await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        successCount++;
      } catch (err) {
        if (err.response?.status === 409) {
          showToast(`"${file.name}" already uploaded`, 'warning');
        } else {
          showToast(`Failed to upload "${file.name}"`, 'error');
        }
      }
    }

    setUploading(false);
    if (successCount > 0) {
      showToast(`${successCount} file(s) encrypted and uploaded`, 'success');
      loadFiles();
    }
  };

  // ── Download Handler ──────────────────────────────────────
  const handleDownload = async (file) => {
    const masterKey = getMasterKey();
    if (!masterKey) return showToast('Session expired. Please log in again.', 'error');

    try {
      const resp = await api.get(`/files/download/${file.id}`, {
        responseType: 'arraybuffer',
      });

      const iv           = resp.headers['x-file-iv'];
      const encryptedKey = resp.headers['x-file-encrypted-key'];
      const keyIv        = resp.headers['x-file-key-iv'];

      const plaintext = await decryptFile(resp.data, iv, encryptedKey, keyIv, masterKey);
      downloadBlob(plaintext, file.filename, file.mimeType);
      showToast(`"${file.filename}" decrypted and saved`, 'success');
    } catch (err) {
      showToast(`Failed to decrypt "${file.filename}"`, 'error');
    }
  };

  // ── Delete Handler ────────────────────────────────────────
  const handleDelete = async (fileId) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    try {
      await api.delete(`/files/${fileId}`);
      setFiles(f => f.filter(x => x.id !== fileId));
      showToast('File deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top Bar ─────────────────────────────────────── */}
      <header className="border-b border-white/[0.06] bg-surface/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-white">SecureVault</span>
            <span className="badge badge-success text-[10px] ml-1">E2E Encrypted</span>
          </div>

          <div className="flex items-center gap-3">
            <SyncStatus status={syncStatus} />
            <span className="text-sm text-muted hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="btn-secondary text-sm py-1.5 px-3">Sign out</button>
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Files',       value: files.length },
            { label: 'Storage Used', value: formatBytes(totalSize) },
            { label: 'Encryption',  value: 'AES-256-GCM', color: 'text-success' },
            { label: 'Key Derivation', value: 'PBKDF2', color: 'text-accent' },
          ].map(s => (
            <div key={s.label} className="card py-3 px-4">
              <p className="text-xs text-muted mb-0.5">{s.label}</p>
              <p className={`font-semibold font-mono text-sm ${s.color || 'text-white'}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Upload Zone */}
        <UploadZone onUpload={handleUpload} uploading={uploading} />

        {/* Tabs */}
        <div className="flex gap-1 mt-6 mb-4 border-b border-white/[0.06]">
          {[['files', 'Files'], ['activity', 'Activity']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px
                ${activeTab === id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'files' && (
          <FileList
            files={files}
            loading={loading}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onShare={f => setShareTarget(f)}
          />
        )}
        {activeTab === 'activity' && <ActivityLog />}
      </main>

      {/* ── Share Modal ───────────────────────────────────── */}
      {shareTarget && (
        <ShareModal
          file={shareTarget}
          getMasterKey={getMasterKey}
          onClose={() => setShareTarget(null)}
          onShared={() => showToast('Share link created', 'success')}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-5 right-5 px-4 py-3 rounded-lg text-sm font-medium shadow-2xl z-50
          border transition-all
          ${toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
            toast.type === 'error'   ? 'bg-danger/10  border-danger/30  text-danger'  :
            toast.type === 'warning' ? 'bg-warning/10 border-warning/30 text-warning' :
                                       'bg-accent/10  border-accent/30  text-accent'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}
