import React, { useCallback, useState } from 'react';

export default function UploadZone({ onUpload, uploading }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files];
    if (files.length) onUpload(files);
  }, [onUpload]);

  const handleInput = (e) => {
    const files = [...e.target.files];
    if (files.length) onUpload(files);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
        ${dragOver   ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-white/10 hover:border-white/20'}
        ${uploading  ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}
      onClick={() => document.getElementById('file-input').click()}
    >
      <input id="file-input" type="file" multiple className="hidden" onChange={handleInput} />

      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-accent animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <div>
            <p className="font-medium text-sm text-white">Encrypting & uploading…</p>
            <p className="text-xs text-muted mt-1">AES-256-GCM encryption in progress</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors
            ${dragOver ? 'border-accent bg-accent/10' : 'border-white/10 bg-panel'}`}>
            <svg className={`w-6 h-6 transition-colors ${dragOver ? 'text-accent' : 'text-muted'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm text-white">
              {dragOver ? 'Drop to encrypt & upload' : 'Drag files here or click to browse'}
            </p>
            <p className="text-xs text-muted mt-1">Files are encrypted in your browser before upload</p>
          </div>
        </div>
      )}
    </div>
  );
}
