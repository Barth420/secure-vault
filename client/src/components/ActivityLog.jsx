import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ACTION_ICONS = {
  UPLOAD:        '↑',
  DOWNLOAD:      '↓',
  DELETE:        '🗑',
  SHARE_CREATE:  '🔗',
  SHARE_ACCESS:  '👁',
  SHARE_REVOKE:  '✕',
  LOGIN:         '🔓',
  REGISTER:      '✨',
};

const ACTION_COLORS = {
  UPLOAD:       'text-success',
  DOWNLOAD:     'text-accent',
  DELETE:       'text-danger',
  SHARE_CREATE: 'text-warning',
  SHARE_ACCESS: 'text-slate-400',
  SHARE_REVOKE: 'text-danger',
  LOGIN:        'text-slate-400',
  REGISTER:     'text-accent',
};

export default function ActivityLog() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    api.get('/sync/activity', { params: { page, limit: LIMIT } })
      .then(({ data }) => { setLogs(data.logs); setTotal(data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) return <div className="text-center py-8 text-muted text-sm">Loading activity…</div>;

  if (!logs.length) return (
    <div className="card text-center py-12">
      <p className="text-muted text-sm">No activity yet</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="card py-2.5 px-4 flex items-center gap-3">
          <span className={`text-base w-6 text-center shrink-0 ${ACTION_COLORS[log.action] || 'text-muted'}`}>
            {ACTION_ICONS[log.action] || '•'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200">
              <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
              {log.file && <span className="text-muted"> — {log.file.filename}</span>}
            </p>
          </div>
          <span className="text-xs text-muted shrink-0">
            {new Date(log.createdAt).toLocaleString()}
          </span>
        </div>
      ))}

      {total > LIMIT && (
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-muted self-center">{page} / {Math.ceil(total/LIMIT)}</span>
          <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/LIMIT)}
            className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
