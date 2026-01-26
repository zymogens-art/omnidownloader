
import React, { useState, useEffect } from 'react';
import { MediaItem, DownloadStatus, MediaType } from './types';
import { analyzeUrls } from './services/geminiService';
import DownloaderCard from './components/DownloaderCard';
import MediaCompressor from './components/MediaCompressor';
import JSZip from 'jszip';

const DB_NAME = 'OmniDownloaderDB';
const STORE_NAME = 'settings';
const HANDLE_KEY = 'dir_handle';

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveHandle = async (handle: FileSystemDirectoryHandle) => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
  return new Promise((resolve) => (tx.oncomplete = resolve));
};

const loadHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
  return new Promise((resolve) => (request.onsuccess = () => resolve(request.result)));
};

const clearHandle = async () => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
  return new Promise((resolve) => (tx.oncomplete = resolve));
};

type TabType = 'download' | 'compress';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('download');
  const [urlInput, setUrlInput] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
  const [prefix, setPrefix] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [fsError, setFsError] = useState<string | null>(null);
  const [isFileSystemSupported] = useState(() => 'showDirectoryPicker' in window);

  useEffect(() => {
    if (isFileSystemSupported) {
      loadHandle().then(handle => {
        if (handle) {
          setDirHandle(handle);
          setDirName(handle.name);
        }
      }).catch(err => console.warn(err));
    }
  }, [isFileSystemSupported]);

  const handleAddUrls = async () => {
    let rawUrls = urlInput.split(/\s+/).map(u => u.trim()).filter(u => u.length > 0);
    rawUrls = rawUrls.map(url => (!url.startsWith('http') && url.includes('.') ? `https://${url}` : url)).filter(url => url.startsWith('http'));

    if (rawUrls.length === 0) return;

    setIsAnalyzing(true);
    const newItems: MediaItem[] = rawUrls.map(url => ({
      id: Math.random().toString(36).substr(2, 9),
      originalUrl: url,
      filename: '分析中...',
      type: MediaType.OTHER,
      status: DownloadStatus.ANALYZING,
      progress: 0
    }));

    setItems(prev => [...newItems, ...prev]);
    setUrlInput('');

    try {
      const results = await analyzeUrls(rawUrls);
      setItems(prev => prev.map(item => {
        const result = results.find(r => r.url === item.originalUrl);
        return result ? { 
          ...item, 
          filename: result.suggestedFilename, 
          originalFilename: result.suggestedFilename,
          type: result.type, 
          status: DownloadStatus.READY, 
          directUrl: item.originalUrl 
        } : item;
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchBlobWithMultiProxy = async (id: string, url: string, isVideo: boolean = false): Promise<Blob> => {
    const updateStatus = (p: number, msg: string, sizeStr?: string) => {
      setItems(prev => prev.map(i => i.id === id ? { ...i, progress: p, simulatedSpeed: msg, simulatedSize: sizeStr || i.simulatedSize } : i));
    };

    const proxies = [{ name: "直連", fn: (u: string) => u }, { name: "代理", fn: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}` }];

    let lastError = '';
    for (const proxy of proxies) {
      try {
        updateStatus(5, `${proxy.name}連接中...`);
        const response = await fetch(proxy.fn(url), { method: 'GET', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const total = parseInt(response.headers.get('content-length') || '0', 10);
        const reader = response.body?.getReader();
        if (!reader) throw new Error('流讀取失敗');

        let received = 0;
        const chunks = [];
        while(true) {
          const {done, value} = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          const p = total ? Math.floor((received / total) * 100) : Math.min(99, Math.floor(received / 1024 / 50));
          updateStatus(p, `下載中...`, `${(received / 1024 / 1024).toFixed(1)} MB`);
        }
        
        // 針對影片，建立特定 MIME 類型的 Blob 以確保 QuickTime 識別
        const finalBlob = new Blob(chunks, { type: isVideo ? 'video/quicktime' : response.headers.get('content-type') || undefined });
        return finalBlob;
      } catch (err: any) {
        lastError = err.message;
        continue;
      }
    }
    throw new Error(lastError || '獲取失敗');
  };

  const downloadSingleFile = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || !item.directUrl) return;

    setItems(prev => prev.map(i => i.id === id ? { ...i, status: DownloadStatus.DOWNLOADING, progress: 0, error: undefined } : i));
    
    try {
      const isVideo = item.type === MediaType.VIDEO;
      const blob = await fetchBlobWithMultiProxy(item.id, item.originalUrl, isVideo);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 確保影片檔名以 .mov 結尾
      let finalFilename = item.filename;
      if (isVideo && !finalFilename.toLowerCase().endsWith('.mov')) {
        finalFilename = finalFilename.replace(/\.[^/.]+$/, "") + ".mov";
      }
      
      link.download = finalFilename;
      link.click();
      URL.revokeObjectURL(url);
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: DownloadStatus.COMPLETED, progress: 100, simulatedSpeed: '已完成' } : i));
    } catch (err: any) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: DownloadStatus.ERROR, error: err.message } : i));
    }
  };

  const handleDownloadAsZip = async () => {
    const targetItems = items.filter(i => i.status === DownloadStatus.READY || i.status === DownloadStatus.ERROR || i.status === DownloadStatus.COMPLETED);
    if (targetItems.length === 0 || isZipping) return;
    setIsZipping(true);
    const zip = new JSZip();
    for (const item of targetItems) {
      try {
        const isVideo = item.type === MediaType.VIDEO;
        const blob = await fetchBlobWithMultiProxy(item.id, item.originalUrl!, isVideo);
        
        let finalFilename = item.filename;
        if (isVideo && !finalFilename.toLowerCase().endsWith('.mov')) {
          finalFilename = finalFilename.replace(/\.[^/.]+$/, "") + ".mov";
        }
        
        zip.file(finalFilename, blob);
      } catch (e) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: DownloadStatus.ERROR, error: '獲取失敗' } : i));
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `Batch_${Date.now()}.zip`;
    link.click();
    setIsZipping(false);
  };

  const applyBulkPrefix = () => {
    if (!prefix.trim()) return;
    setItems(prev => prev.map(item => ({
      ...item,
      filename: `${prefix.trim()}${item.filename}`
    })));
    setPrefix('');
  };

  const applySequence = () => {
    setItems(prev => prev.map((item, idx) => {
      const extMatch = item.filename.match(/\.[0-9a-z]+$/i);
      const ext = extMatch ? extMatch[0] : '';
      const baseName = item.filename.replace(ext, '');
      return {
        ...item,
        filename: `${baseName}-${(idx + 1).toString().padStart(2, '0')}${ext}`
      };
    }));
  };

  const applySearchReplace = () => {
    if (!searchQuery) return;
    setItems(prev => prev.map(item => ({
      ...item,
      filename: item.filename.replaceAll(searchQuery, replaceValue)
    })));
    setSearchQuery('');
    setReplaceValue('');
  };

  const resetFilenames = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      filename: item.originalFilename || item.filename
    })));
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col max-w-6xl mx-auto selection:bg-blue-500/30">
      <header className="mb-12 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/10 blur-[120px] rounded-full -z-10" />
        <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-6 tracking-tight">
          OmniDownloader Pro
        </h1>
        
        <div className="flex justify-center mb-8">
           <nav className="flex p-1 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl">
              <button onClick={() => setActiveTab('download')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'download' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'}`}>
                檔案下載
              </button>
              <button onClick={() => setActiveTab('compress')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'compress' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'}`}>
                壓縮檔案
              </button>
           </nav>
        </div>
      </header>

      <main className="flex-1">
        {activeTab === 'download' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-slate-800/20 border border-slate-700/50 p-6 rounded-[2.5rem] shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="在此處貼上網址..."
                className="w-full h-32 bg-transparent text-slate-100 placeholder:text-slate-600 focus:ring-0 text-lg font-medium resize-none"
              />
              <div className="mt-6 flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-800/50">
                <button onClick={handleAddUrls} disabled={!urlInput.trim() || isAnalyzing} className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-[0.98]">
                  {isAnalyzing ? "分析中..." : "解析並加入隊列"}
                </button>
                {items.length > 0 && (
                  <button onClick={() => setItems([])} className="flex-1 px-8 py-4 rounded-2xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 transition-all">
                    清空隊列
                  </button>
                )}
              </div>
            </section>

            {items.length > 0 && (
              <section className="space-y-6">
                <div className="p-6 bg-slate-800/40 border border-slate-700/30 rounded-[2rem] flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">批次更名</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">＋前綴字</label>
                      <div className="flex bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
                        <input type="text" placeholder="例如: Travel_" value={prefix} onChange={e => setPrefix(e.target.value)} className="bg-transparent text-xs px-3 py-2 outline-none flex-1 font-medium" />
                        <button onClick={applyBulkPrefix} className="bg-blue-600 hover:bg-blue-500 text-[10px] font-bold px-3 transition-colors">添加</button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 lg:col-span-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">搜尋與替換</label>
                      <div className="flex bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden">
                        <input type="text" placeholder="搜尋..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent text-xs px-3 py-2 outline-none flex-1 font-medium border-r border-slate-700/50" />
                        <input type="text" placeholder="替換為..." value={replaceValue} onChange={e => setReplaceValue(e.target.value)} className="bg-transparent text-xs px-3 py-2 outline-none flex-1 font-medium" />
                        <button onClick={applySearchReplace} className="bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold px-4 transition-colors">替換</button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">操作</label>
                      <div className="flex gap-2">
                        <button onClick={applySequence} className="flex-1 bg-slate-700 hover:bg-slate-600 text-[10px] font-bold py-2 rounded-xl border border-slate-600/50 transition-colors">＋序號</button>
                        <button onClick={resetFilenames} className="px-3 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 text-[10px] font-bold rounded-xl border border-rose-900/30 transition-colors" title="恢復原始檔名">重置</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center px-4">
                  <h4 className="text-sm font-bold text-slate-500">待下載 ({items.length})</h4>
                  <button onClick={handleDownloadAsZip} disabled={isZipping} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                    {isZipping ? "打包中..." : "打包 ZIP 下載"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                  {items.map(item => (
                    <DownloaderCard key={item.id} item={item} onDownload={downloadSingleFile} onRemove={id => setItems(p => p.filter(x => x.id !== id))} onRename={(id, name) => setItems(prev => prev.map(i => i.id === id ? { ...i, filename: name } : i))} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <MediaCompressor />
        )}
      </main>
      <footer className="py-10 text-center border-t border-slate-800/50 opacity-40">
        <p className="text-[10px] uppercase tracking-widest font-bold">OmniDownloader Pro Engine • 瀏覽器原生處理</p>
      </footer>
    </div>
  );
};

export default App;
