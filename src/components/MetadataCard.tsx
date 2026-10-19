import React from 'react';
import { FileVideo, Clock, Maximize2, Activity, Volume2, HardDrive, RefreshCw } from 'lucide-react';
import type { VideoMetadata } from '../types';
import { formatBytes, formatDuration } from '../utils/formatters';

interface MetadataCardProps {
  metadata: VideoMetadata;
  onChangeFile: () => void;
}

export const MetadataCard: React.FC<MetadataCardProps> = ({ metadata, onChangeFile }) => {
  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <FileVideo size={22} />
          </div>
          <div>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#fff',
                wordBreak: 'break-all',
              }}
            >
              {metadata.fileName}
            </h3>
            <p
              className="font-mono"
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-dim)',
                marginTop: '2px',
                wordBreak: 'break-all',
              }}
              title={metadata.filePath}
            >
              {metadata.filePath}
            </p>
          </div>
        </div>

        <button
          onClick={onChangeFile}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', padding: '6px 14px' }}
        >
          <RefreshCw size={14} />
          <span>Change Video</span>
        </button>
      </div>

      {/* Grid of video metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
        }}
      >
        {/* File Size */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <HardDrive size={14} />
            <span>Original Size</span>
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {formatBytes(metadata.fileSize)}
          </div>
        </div>

        {/* Duration */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Clock size={14} />
            <span>Duration</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {formatDuration(metadata.duration)}
          </div>
        </div>

        {/* Resolution */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Maximize2 size={14} />
            <span>Dimensions</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {metadata.width} × {metadata.height}
          </div>
        </div>

        {/* Frame Rate */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Activity size={14} />
            <span>Frame Rate</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {metadata.fps} fps
          </div>
        </div>

        {/* Codecs */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Volume2 size={14} />
            <span>Audio & Codec</span>
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
            {metadata.videoCodec.toUpperCase()}
            {metadata.audioCodec ? ` / ${metadata.audioCodec.toUpperCase()}` : ' (No Audio)'}
          </div>
        </div>
      </div>
    </div>
  );
};
