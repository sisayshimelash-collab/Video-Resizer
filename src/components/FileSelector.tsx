import React, { useState, useEffect, useRef } from 'react';
import { Film, FolderSearch, ArrowRight, Loader2, AlertCircle, XCircle, Sparkles, Folder } from 'lucide-react';
import { openFilePicker, cancelFileDialog, fetchQuickVideos, type QuickVideo } from '../api';
import { formatBytes } from '../utils/formatters';

interface FileSelectorProps {
  onFileSelect: (filePath: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  onFileSelect,
  isLoading,
  error,
}) => {
  const [manualPath, setManualPath] = useState('');
  const [isOpeningDialog, setIsOpeningDialog] = useState(false);
  const [quickVideos, setQuickVideos] = useState<QuickVideo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchQuickVideos().then((videos) => {
      setQuickVideos(videos);
    });
  }, []);

  const handleOpenNativeDialog = async () => {
    try {
      setIsOpeningDialog(true);
      const result = await openFilePicker();
      if (!result.canceled && result.path) {
        setManualPath(result.path);
        await onFileSelect(result.path);
      }
    } catch (err: any) {
      console.error('File dialog failed:', err);
    } finally {
      setIsOpeningDialog(false);
    }
  };

  const handleCancelDialog = async () => {
    try {
      await cancelFileDialog();
    } finally {
      setIsOpeningDialog(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPath.trim()) return;
    await onFileSelect(manualPath.trim());
  };

  // Browser standard input fallback
  const handleBrowserFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if electron file.path exists
    const directPath = (file as any).path;
    if (directPath) {
      await onFileSelect(directPath);
      return;
    }

    // Try finding exact match in quick-videos by file.name and file.size
    const matched = quickVideos.find((q) => q.name === file.name || q.size === file.size);
    if (matched) {
      await onFileSelect(matched.path);
      return;
    }

    // Fallback: put file name in manual path input and prompt
    setManualPath(file.name);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Main Selector Box */}
      <div
        className="glass-panel"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) {
            const directPath = (file as any).path;
            if (directPath) {
              await onFileSelect(directPath);
            } else {
              const matched = quickVideos.find((q) => q.name === file.name || q.size === file.size);
              if (matched) {
                await onFileSelect(matched.path);
              } else {
                setManualPath(file.name);
              }
            }
          }
        }}
        style={{
          padding: '2.5rem',
          textAlign: 'center',
          border: isDragging ? '2px dashed #6366f1' : undefined,
          background: isDragging ? 'rgba(99, 102, 241, 0.1)' : undefined,
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            maxWidth: '580px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          {/* Animated icon container */}
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '24px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
              boxShadow: '0 0 30px rgba(99, 102, 241, 0.2)',
            }}
          >
            <Film size={36} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
              Select Video to Compress
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.5 }}>
              Select any local screen recording or video. Large files up to 2 GB+ are processed safely via native FFmpeg without uploading.
            </p>
          </div>

          {/* Action button states */}
          <div style={{ width: '100%', marginTop: '0.5rem' }}>
            {isOpeningDialog ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#a5b4fc', fontWeight: 600 }}>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Windows File Dialog is Open...</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Check your Windows taskbar if the File Explorer window opened behind your browser.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleCancelDialog}
                    className="btn-danger"
                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  >
                    <XCircle size={14} />
                    <span>Cancel Dialog</span>
                  </button>
                </div>
              </div>
            ) : isLoading ? (
              <button
                type="button"
                className="btn-primary"
                disabled
                style={{ width: '100%', padding: '16px 28px', fontSize: '1.05rem' }}
              >
                <Loader2 size={20} className="animate-spin" />
                <span>Inspecting Video Metadata...</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleOpenNativeDialog}
                  style={{ flex: 1, padding: '16px 24px', fontSize: '1.05rem' }}
                >
                  <FolderSearch size={20} />
                  <span>Browse Video on PC...</span>
                </button>

                {/* Hidden standard browser file input */}
                <input
                  type="file"
                  ref={hiddenFileInputRef}
                  accept="video/*"
                  onChange={handleBrowserFileChosen}
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>

          {/* Alternative: Direct Path Input */}
          <div style={{ width: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                margin: '0.75rem 0',
                color: 'var(--text-dim)',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span>or paste local file path</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="e.g. C:\Users\sisay\Videos\Screen Recordings\Lecture.mp4"
                className="font-mono"
                style={{
                  flex: 1,
                  background: 'rgba(10, 14, 25, 0.8)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                className="btn-secondary"
                disabled={isLoading || !manualPath.trim()}
                style={{ padding: '10px 16px' }}
              >
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Error notification */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fda4af',
                fontSize: '0.88rem',
                textAlign: 'left',
                width: '100%',
                marginTop: '0.5rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Access to Detected Screen Recordings */}
      {quickVideos.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <Sparkles size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
              Detected Screen Recordings on Your PC
            </h3>
            <span className="badge badge-indigo" style={{ marginLeft: 'auto' }}>
              1-Click Select
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '10px',
            }}
          >
            {quickVideos.map((vid) => (
              <div
                key={vid.path}
                onClick={() => onFileSelect(vid.path)}
                className="glass-panel-interactive"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Folder size={14} color="var(--primary)" />
                  <span style={{ fontSize: '0.72rem', color: '#a5b4fc', textTransform: 'uppercase' }}>
                    {vid.folder}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={vid.name}
                >
                  {vid.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {formatBytes(vid.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
