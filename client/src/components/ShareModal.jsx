import React, { useState } from 'react';
import api from '../services/api';
import { createShareKey } from '../utils/crypto';

const EXPIRY_OPTIONS = [
  { label: 'Never',   value: null },
  { label: '1 hour',  value: 3600 },
  { label: '24 hours',value: 86400 },
  { label: '7 days',  value: 604800 },
];

export default function ShareModal({ file, getMasterKey, onClose, onShared }) {
  const [password,   setPassword]   = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [expiresIn,  setExpiresIn]  = useState(null);
  const [maxAccess,  setMaxAccess]  = useState('');
  const [loading,    setLoading]    = useState(false);
  const [shareUrl,   setShareUrl]   = useState('');
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      let shareKeyData = {};

      if (usePassword && password) {
        const masterKey = getMasterKey();
        if (!masterKey) throw new Error('Session expired');
        shareKeyData = await createShareKey(
          file.encryptedKey, file.keyIv, masterKey, password
        );
      }

      const { data } = await api.post('/share/create', {
        fileId:     file.id,
        expiresIn:  expiresIn || undefined,
        maxAccess:  maxAccess ? parseInt(maxAccess) : undefined,
        password:   usePassword ? password : undefined,
        shareKey:   shareKeyData.shareKey,
        shareKeyIv: shareKeyData.shareKeyIv,
        shareSalt:  shareKeyData.shareSalt,
      });

      const shareUrl = `${window.location.origin}/share/${data.share.token}`;
      setShareUrl(shareUrl);
      onShared();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-white">Share File</h2>
            <p className="text-xs text-muted mt-0.5 truncate max-w-xs">{file.filename}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!shareUrl ? (
          <div className="space-y-4">
            {/* Expiry */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Link Expiry</label>
              <div className="grid grid-cols-2 gap-2">
                {EXPIRY_OPTIONS.map(opt => (
                  <button key={opt.label} onClick={() => setExpiresIn(opt.value)}
                    className={`py-2 px-3 rounded-lg border text-sm transition-colors
                      ${expiresIn === opt.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-white/10 text-muted hover:border-white/20 hover:text-slate-300'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Access */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Max Downloads <span className="text-muted font-normal">(optional)</span>
              </label>
              <input type="number" className="input" placeholder="Unlimited"
                value={maxAccess} onChange={e => setMaxAccess(e.target.value)} min="1" />
            </div>

            {/* Password */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" checked={usePassword}
                  onChange={e => setUsePassword(e.target.checked)}
                  className="rounded accent-accent" />
                <span className="text-sm font-medium text-slate-300">Password protect</span>
              </label>
              {usePassword && (
                <input type="password" className="input" placeholder="Share password"
                  value={password} onChange={e => setPassword(e.target.value)} />
              )}
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} className="btn-primary flex-1" disabled={loading}>
                {loading ? 'Creating…' : 'Create Link'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success mb-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Share link created</span>
            </div>

            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="input text-xs font-mono flex-1" />
              <button onClick={copyLink} className="btn-secondary shrink-0 px-3">
                {copied ? '✓' : 'Copy'}
              </button>
            </div>

            {usePassword && (
              <p className="text-xs text-warning bg-warning/5 border border-warning/20 rounded-lg p-2">
                Share the password separately from the link.
              </p>
            )}

            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
