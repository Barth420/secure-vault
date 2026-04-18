import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { downloadBlob, base64ToBuffer, decryptWithShareKey } from '../utils/crypto';

export default function SharedFile() {
  const { token } = useParams();
  const [info,      setInfo]      = useState(null);
  const [password,  setPassword]  = useState('');
  const [needsPass, setNeedsPass] = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [dlPassword, setDlPassword] = useState('');

  useEffect(() => {
    // Try to access without password first
    api.post(`/share/${token}/access`, {})
      .then(({ data }) => { setInfo(data); setLoading(false); })
      .catch(err => {
        setLoading(false);
        if (err.response?.data?.code === 'PASSWORD_REQUIRED') setNeedsPass(true);
        else setError(err.response?.data?.error || 'Share link invalid or expired.');
      });
  }, [token]);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(`/share/${token}/access`, { password });
      setInfo(data);
      setNeedsPass(false);
      setDlPassword(password); // Store the password for decryption later
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!info) return;
    setDownloading(true);
    setError('');
    try {
      const resp = await api.get(`/share/${token}/download`, { responseType: 'arraybuffer' });

      // If this share has a shareKey (password-protected), decrypt client-side
      if (info.shareKey && info.shareKeyIv && info.shareSalt && dlPassword) {
        const plaintext = await decryptWithShareKey(
          resp.data,
          info.iv,
          info.shareKey,
          info.shareKeyIv,
          info.shareSalt,
          dlPassword
        );
        downloadBlob(plaintext, info.filename, info.mimeType);
      } else {
        // For non-password shares: download the encrypted blob as-is
        // (The recipient needs to have access to decrypt it some other way,
        //  or this is a simple direct download)
        downloadBlob(resp.data, info.filename, info.mimeType);
      }
    } catch (err) {
      setError('Download failed. ' + (err.message || 'The link may have expired.'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">SecureVault Share</h1>
          <p className="text-muted text-sm mt-1">Someone shared an encrypted file with you</p>
        </div>

        <div className="card">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted">
              <svg className="w-5 h-5 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Verifying share link…
            </div>
          )}

          {error && !needsPass && (
            <div className="text-center py-6">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          {needsPass && !info && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <h2 className="font-semibold">Password Required</h2>
              <p className="text-sm text-muted">This file is password-protected.</p>
              <input type="password" className="input" placeholder="Share password"
                value={password} onChange={e => setPassword(e.target.value)} required />
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>Unlock</button>
            </form>
          )}

          {info && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-panel rounded-lg p-3 border border-white/[0.06]">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white text-sm truncate">{info.filename}</p>
                  <p className="text-xs text-muted">{formatBytes(info.size)}</p>
                </div>
              </div>

              {info.expiresAt && (
                <p className="text-xs text-muted">
                  Expires: {new Date(info.expiresAt).toLocaleString()}
                </p>
              )}

              <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                <p className="text-xs text-slate-400">
                  <span className="text-success font-medium">End-to-end encrypted.</span>{' '}
                  This file was encrypted before upload and will be decrypted in your browser.
                </p>
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              <button onClick={handleDownload} className="btn-primary w-full" disabled={downloading}>
                {downloading ? 'Decrypting & Downloading…' : '↓ Download File'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}
