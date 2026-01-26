
import React, { useState, useCallback } from 'react';
import { CompressedFile } from './CompressorItem';
import CompressorItem from './CompressorItem';
import JSZip from 'jszip';

const MediaCompressor: React.FC = () => {
  const [items, setItems] = useState<CompressedFile[]>([]);
  // 預設品質 20%, 尺寸縮放 60%
  const [quality, setQuality] = useState(0.2);
  const [scale, setScale] = useState(0.6);
  const [isZipping, setIsZipping] = useState(false);

  const compressImage = async (file: File, q: number, s: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No context');

        canvas.width = img.width * s;
        canvas.height = img.height * s;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject('Compression failed');
          },
          'image/jpeg',
          q
        );
      };
      img.onerror = reject;
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: CompressedFile[] = fileArray.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      compressedBlob: null,
      originalSize: file.size,
      compressedSize: null,
      status: 'pending',
      progress: 0,
      previewUrl: URL.createObjectURL(file)
    }));

    setItems(prev => [...newItems, ...prev]);

    for (const item of newItems) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));
      
      try {
        let compressedBlob: Blob;
        if (item.file.type.startsWith('image/')) {
          compressedBlob = await compressImage(item.file, quality, scale);
        } else {
          // 影片採取直通以確保 QuickTime 相容性
          compressedBlob = item.file; 
        }

        setItems(prev => prev.map(i => i.id === item.id ? { 
          ...i, 
          status: 'completed', 
          compressedBlob, 
          compressedSize: compressedBlob.size,
          progress: 100 
        } : i));
      } catch (err) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error' } : i));
      }
    }
  };

  const handleSelectFiles = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          startIn: 'desktop',
          types: [
            {
              description: '媒體檔案',
              accept: {
                'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
                'video/*': ['.mp4', '.mov', '.webm']
              }
            }
          ]
        });
        const files = await Promise.all(handles.map((handle: any) => handle.getFile()));
        processFiles(files);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          document.getElementById('file-upload')?.click();
        }
      }
    } else {
      document.getElementById('file-upload')?.click();
    }
  };

  const getOutputFilename = (file: File) => {
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    // 圖片轉為 jpg，影片保留原始副檔名以維持相容性
    const extension = file.type.startsWith('image/') ? ".jpg" : file.name.slice(file.name.lastIndexOf('.'));
    return `${baseName}${extension}`;
  };

  const handleDownload = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item?.compressedBlob) {
      const url = URL.createObjectURL(item.compressedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getOutputFilename(item.file);
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadAll = async () => {
    const completedItems = items.filter(i => i.status === 'completed' && i.compressedBlob);
    if (completedItems.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      completedItems.forEach(item => {
        const name = getOutputFilename(item.file);
        zip.file(name, item.compressedBlob!);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Compressed_Batch_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Zipping error:", error);
    } finally {
      setIsZipping(false);
    }
  };

  const handleRemove = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    processFiles(e.dataTransfer.files);
  };

  const completedCount = items.filter(i => i.status === 'completed').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div 
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className="relative group overflow-hidden bg-slate-800/20 border-2 border-dashed border-slate-700/50 rounded-[2.5rem] p-12 flex flex-col items-center justify-center transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform duration-500">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-100 mb-2">拖拽媒體檔案到此處</h3>
        <p className="text-slate-500 text-sm mb-6">支援 JPEG, PNG, WEBP 以及影片檔案</p>
        
        <button 
          onClick={handleSelectFiles}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-xl shadow-emerald-900/20 z-10"
        >
          選擇檔案
        </button>

        <input 
          type="file" 
          multiple 
          accept="image/*,video/*" 
          onChange={e => e.target.files && processFiles(e.target.files)} 
          className="hidden" 
          id="file-upload" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-3xl">
            <h4 className="text-sm font-bold text-slate-100 mb-6 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              壓縮參數
            </h4>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                  <span>輸出品質</span>
                  <span className="text-emerald-400">{Math.round(quality * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.05" max="1" step="0.05" 
                  value={quality} onChange={e => setQuality(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500" 
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                  <span>尺寸縮放</span>
                  <span className="text-emerald-400">{Math.round(scale * 100)}%</span>
                </div>
                <input 
                  type="range" min="0.1" max="1" step="0.1" 
                  value={scale} onChange={e => setScale(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500" 
                />
              </div>
            </div>
          </div>
          <div className="bg-purple-900/10 border border-purple-900/20 p-4 rounded-2xl">
             <p className="text-[10px] text-purple-400 leading-relaxed">
               <strong>註記:</strong> 影片將以原始編碼輸出以確保 <strong>QuickTime Player</strong> 的播放相容性。
             </p>
          </div>
        </aside>

        <div className="lg:col-span-3">
          {items.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2 px-2">
                <h4 className="text-sm font-bold text-slate-400">處理隊列 ({items.length})</h4>
                <div className="flex items-center gap-3">
                  {completedCount > 0 && (
                    <button 
                      onClick={handleDownloadAll} 
                      disabled={isZipping}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isZipping ? "打包中..." : `打包 ZIP 下載 (${completedCount})`}
                    </button>
                  )}
                  <button onClick={() => setItems([])} className="text-xs text-rose-400 hover:underline">清空全部</button>
                </div>
              </div>
              <div className="space-y-3">
                {items.map(item => (
                  <CompressorItem key={item.id} item={item} onDownload={handleDownload} onRemove={handleRemove} />
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-800/50 rounded-[2.5rem]">
              <p className="text-sm font-medium">暫無檔案</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaCompressor;
