import React from 'react';

export default function SyncStatus({ status }) {
  if (!status) return null;

  return (
    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted"
      title={`Last modified: ${status.lastModified ? new Date(status.lastModified).toLocaleString() : 'Never'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
      <span>{status.totalFiles} file{status.totalFiles !== 1 ? 's' : ''} synced</span>
    </div>
  );
}
