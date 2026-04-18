import React from 'react';

const FILE_ICONS = {
  'image/':       '🖼',
  'video/':       '🎥',
  'audio/':       '🎵',
  'application/pdf': '📄',
  'text/':        '📝',
  'application/zip': '🗜',
  'default':      '📁',
};

function getFileIcon(mimeType) {
  for (const [key, icon] of Object.entries(FILE_ICONS)) {
    if (mimeType.startsWith(key)) return icon;
  }
  return FILE_ICONS.default;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function FileList({ files, loading, onDownload, onDelete, onShare }) {
  if (loading) return (
    <div className="grid gap-2">
      {[1,2,3].map(i => (
        <div key={i} className="card animate-pulse h-16 opacity-50" />
      ))}
    </div>
  );

  if (!files.length) return (
    <div className="card text-center py-12">
      <p className="text-3xl mb-3">🔒</p>
      <p className="font-medium text-slate-300">Your vault is empty</p>
      <p className="text-sm text-muted mt-1">Upload files above to encrypt and store them</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {files.map(file => (
        <div key={file.id}
          className="card py-3 px-4 flex items-center gap-4 hover:border-white/10 transition-colors">
          {/* Icon */}
          <span className="text-2xl shrink-0">{getFileIcon(file.mimeType)}</span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-white truncate">{file.filename}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-muted">{formatBytes(file.size)}</span>
              <span className="text-xs text-muted">{formatDate(file.createdAt)}</span>
              <span className="badge badge-success text-[10px]">🔒 Encrypted</span>
              {file._count?.shares > 0 && (
                <span className="badge badge-accent text-[10px]">{file._count.shares} share(s)</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onDownload(file)}
              className="btn-secondary text-xs py-1.5 px-3"
              title="Decrypt and download">
              ↓ Download
            </button>
            <button onClick={() => onShare(file)}
              className="btn-secondary text-xs py-1.5 px-3 text-accent border-accent/20 hover:border-accent/40"
              title="Create share link">
              Share
            </button>
            <button onClick={() => onDelete(file.id)}
              className="btn-danger"
              title="Delete file">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
