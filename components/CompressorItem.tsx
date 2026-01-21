
import React from 'react';

export interface CompressedFile {
  id: string;
  file: File;
  compressedBlob: Blob | null;
  originalSize: number;
  compressedSize: number | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  previewUrl: string;
}

interface CompressorItemProps {
  item: CompressedFile;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
}

const CompressorItem: React.FC<CompressorItemProps> = ({ item, onDownload, onRemove }) => {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isImage = item.file.type.startsWith('image/');
  const isVideo = item.file.type.startsWith('video/');

  const savings = item.compressedSize 
    ? Math.round((1 - item.compressedSize / item.originalSize) * 100)
    : 0;

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex gap-4 items-center group transition-all hover:bg-slate-800/60">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-700/50">
        {isImage ? (
          <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
        ) : isVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
            <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-700">
             <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-1">
          <h4 className="text-sm font-semibold text-slate-100 truncate pr-4">{item.file.name}</h4>
          {item.status === 'completed' && savings > 0 && (
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              Saved {savings}%
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mb-2">
          <span>{formatSize(item.originalSize)}</span>
          {item.compressedSize && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              <span className="text-emerald-400 font-bold">{formatSize(item.compressedSize)}</span>
            </>
          )}
        </div>

        {item.status === 'processing' && (
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {item.status === 'completed' ? (
          <button 
            onClick={() => onDownload(item.id)}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-900/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        ) : (
          <div className="p-2 opacity-20">
             <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent animate-spin rounded-full" />
          </div>
        )}
        <button 
          onClick={() => onRemove(item.id)}
          className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default CompressorItem;
