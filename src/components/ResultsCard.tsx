import React, { useState } from 'react';
import { CheckCircle, FolderOpen, RotateCcw, ArrowDownRight, Sparkles, Copy, Check } from 'lucide-react';
import type { CompressionJob } from '../types';
import { formatBytes, formatDuration } from '../utils/formatters';
import { openInExplorer } from '../api';

interface ResultsCardProps {
  job: CompressionJob;
  onCompressAnother: () => void;
}

export const ResultsCard: React.FC<ResultsCardProps> = ({ job, onCompressAnother }) => {
  const [copied, setCopied] = useState(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

  const handleCopyPath = () => {
    navigator.clipboard.writeText(job.destinationPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFolder = async () => {
    try {
      setIsOpeningFolder(true);
      await openInExplorer(job.destinationPath);
    } catch (err) {
      console.error('Failed to open explorer:', err);
    } finally {
      setIsOpeningFolder(false);
    }
  };

  const originalSize = job.originalSize || 0;
  const compressedSize = job.compressedSize || 0;
  const savedBytes = job.savedBytes || Math.max(0, originalSize - compressedSize);
  const reductionPct = job.reductionPercentage || (originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0);

  return (
    <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
      {/* Success Badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '18px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#34d399',
            boxShadow: '0 0 25px rgba(16, 185, 129, 0.25)',
          }}
        >
          <CheckCircle size={28} />
        </div>
      </div>

      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
        Compression Complete & Verified!
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '500px', margin: '0 auto 1.75rem auto' }}>
        The output video has been verified via ffprobe, is fully playable, and is ready on your PC.
      </p>

      {/* Comparison Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          maxWidth: '720px',
          margin: '0 auto 1.75rem auto',
          textAlign: 'left',
        }}
      >
        {/* Original */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Original Size
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8', marginTop: '4px' }}>
            {formatBytes(originalSize)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Original duration: {formatDuration(job.totalDuration)}
          </div>
        </div>

        {/* Compressed */}
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Compressed Size
            </span>
            <span className="badge badge-indigo">
              <Sparkles size={11} />
              {job.preset.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
            {formatBytes(compressedSize)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#a5b4fc', marginTop: '4px' }}>
            Processed in {formatDuration(job.elapsedSeconds)}
          </div>
        </div>

        {/* Space Saved */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Disk Space Saved
            </span>
            <span className="badge badge-green">
              <ArrowDownRight size={13} />
              {reductionPct}% Saved
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            -{formatBytes(savedBytes)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6ee7b7', marginTop: '4px' }}>
            {reductionPct}% smaller footprint
          </div>
        </div>
      </div>

      {/* Destination Path Display */}
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto 2rem auto',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ textAlign: 'left', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Saved Output File
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: '0.85rem',
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '2px',
            }}
            title={job.destinationPath}
          >
            {job.destinationPath}
          </div>
        </div>

        <button
          onClick={handleCopyPath}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0 }}
          title="Copy file path"
        >
          {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleOpenFolder}
          disabled={isOpeningFolder}
          className="btn-primary"
          style={{ padding: '14px 28px', fontSize: '1rem' }}
        >
          <FolderOpen size={18} />
          <span>Open in File Explorer</span>
        </button>

        <button
          type="button"
          onClick={onCompressAnother}
          className="btn-secondary"
          style={{ padding: '14px 24px', fontSize: '1rem' }}
        >
          <RotateCcw size={18} />
          <span>Compress Another Video</span>
        </button>
      </div>
    </div>
  );
};
