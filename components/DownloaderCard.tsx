
import React, { useState, useRef, useEffect } from 'react';
import { MediaItem, DownloadStatus, MediaType } from '../types';

interface DownloaderCardProps {
  item: MediaItem;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

const DownloaderCard: React.FC<DownloaderCardProps> = ({ item, onDownload, onRemove, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.filename);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (item.status === DownloadStatus.READY || item.status === DownloadStatus.ERROR) {
      setIsEditing(true);
      setEditValue(item.filename);
    }
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.filename) {
      onRename(item.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  const getIcon = () => {
    switch (item.type) {
      case MediaType.IMAGE: return (
        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      );
      case MediaType.VIDEO: return (
        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      );
      case MediaType.DOCUMENT: return (
        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      );
      default: return (
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      );
    }
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case DownloadStatus.ANALYZING: return <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 animate-pulse border border-blue-800/50">Analyzing</span>;
      case DownloadStatus.DOWNLOADING: return <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50">Downloading</span>;
      case DownloadStatus.COMPLETED: return <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800/50">Completed</span>;
      case DownloadStatus.ERROR: return <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-rose-900/40 text-rose-300 border border-rose-800/50">Failed</span>;
      default: return <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-slate-800/50 text-slate-400 border border-slate-700/50">Ready</span>;
    }
  };

  const isDownloading = item.status === DownloadStatus.DOWNLOADING;
  const canEdit = !isDownloading && item.status !== DownloadStatus.ANALYZING && item.status !== DownloadStatus.COMPLETED;

  return (
    <div className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 rounded-2xl p-4 transition-all hover:bg-slate-800/50 hover:border-slate-600/50 group">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-slate-900/80 rounded-xl shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1 gap-2">
            {isEditing ? (
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={handleKeyDown}
                  className="w-full text-sm font-semibold text-slate-100 bg-slate-900 border border-blue-500/50 rounded-lg px-2 py-1 outline-none ring-2 ring-blue-500/20"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center min-w-0 gap-1.5 group/title">
                <h3 
                  onClick={handleStartEdit}
                  className={`text-sm font-semibold text-slate-100 truncate ${canEdit ? 'cursor-text hover:text-blue-400 transition-colors' : ''}`} 
                  title={item.filename}
                >
                  {item.filename || 'Untitled Resource'}
                </h3>
                {canEdit && (
                  <button 
                    onClick={handleStartEdit}
                    className="p-1 text-slate-500 hover:text-blue-400 opacity-0 group-hover/title:opacity-100 transition-all rounded-md hover:bg-slate-700/50"
                    title="Rename File"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                )}
              </div>
            )}
            {getStatusBadge()}
          </div>
          <p className="text-[10px] text-slate-500 truncate mb-4 font-mono">{item.originalUrl}</p>
          
          {isDownloading && (
            <div className="space-y-2 mb-4">
              <div className="w-full bg-slate-900/80 rounded-full h-2 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-400 h-full transition-all duration-500 ease-out relative" 
                  style={{ width: `${item.progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-medium font-mono text-slate-400 uppercase tracking-tighter">
                <div className="flex gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    {item.simulatedSpeed}
                  </span>
                  <span>{item.simulatedSize}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>{item.simulatedEta}</span>
                  <span className="text-blue-400 font-bold ml-1">{item.progress}%</span>
                </div>
              </div>
            </div>
          )}

          {!isDownloading && item.status === DownloadStatus.COMPLETED && (
             <div className="mb-4 flex items-center gap-2 text-[10px] text-emerald-400 font-medium bg-emerald-900/10 px-2 py-1 rounded-md border border-emerald-900/20">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Saved: <span className="font-bold truncate">{item.filename}</span>
             </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(item.id)}
              disabled={isDownloading || item.status === DownloadStatus.ANALYZING || isEditing}
              className={`flex-1 text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
                item.status === DownloadStatus.COMPLETED 
                ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {item.status === DownloadStatus.COMPLETED ? 'Download Again' : 'Download Now'}
            </button>
            <button
              onClick={() => onRemove(item.id)}
              disabled={isDownloading}
              className="p-2.5 bg-slate-800/50 text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 rounded-xl transition-all border border-slate-700/50 disabled:opacity-20"
              title="Remove"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>
      {item.error && (
        <p className="mt-3 px-3 py-1.5 bg-rose-950/20 border border-rose-900/30 rounded-lg text-[10px] text-rose-400 text-center italic font-medium">
          {item.error}
        </p>
      )}
    </div>
  );
};

export default DownloaderCard;
