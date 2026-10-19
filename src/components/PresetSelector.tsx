import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, AlertTriangle, Sliders } from 'lucide-react';
import type { CompressionPreset, ResolutionOption } from '../types';

interface PresetSelectorProps {
  selectedPreset: CompressionPreset;
  onSelectPreset: (preset: CompressionPreset) => void;
  selectedResolution: ResolutionOption;
  onSelectResolution: (res: ResolutionOption) => void;
  sourceWidth?: number;
  sourceHeight?: number;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  selectedPreset,
  onSelectPreset,
  selectedResolution,
  onSelectResolution,
  sourceWidth = 1920,
  sourceHeight = 1080,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const presets: Array<{
    id: CompressionPreset;
    title: string;
    crf: number;
    badge?: string;
    description: string;
    clarityNote?: string;
  }> = [
    {
      id: 'high',
      title: 'High Quality',
      crf: 18,
      badge: 'Maximum Fidelity',
      description: 'Preserves fine fonts, terminal code, diagrams, and screen recordings with near-lossless clarity.',
    },
    {
      id: 'balanced',
      title: 'Balanced',
      crf: 21,
      badge: 'Recommended',
      description: 'The sweet spot for lectures and tutorials. Significant file size reduction while keeping slides and text sharp.',
    },
    {
      id: 'small',
      title: 'Smaller File',
      crf: 24,
      badge: 'Compact',
      description: 'Maximum space reduction for email or quick messaging attachments.',
      clarityNote: 'Notice: Very small text or subpixel code lines may lose subtle sharpness.',
    },
  ];

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
          Compression Preset
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '2px' }}>
          Prioritize visual clarity. Lossless-like H.264 video with AAC audio.
        </p>
      </div>

      {/* Preset cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '14px',
          marginBottom: '1.25rem',
        }}
      >
        {presets.map((p) => {
          const isSelected = selectedPreset === p.id;
          return (
            <div
              key={p.id}
              onClick={() => onSelectPreset(p.id)}
              className="glass-panel-interactive"
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: isSelected
                  ? 'rgba(99, 102, 241, 0.12)'
                  : 'var(--bg-surface-elevated)',
                border: isSelected
                  ? '2px solid #6366f1'
                  : '1px solid var(--border-subtle)',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                    {p.title}
                  </h4>
                  <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    CRF {p.crf}
                  </span>
                </div>
                {isSelected ? (
                  <CheckCircle2 size={18} color="#6366f1" />
                ) : (
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                )}
              </div>

              {p.badge && (
                <div style={{ marginBottom: '8px' }}>
                  <span
                    className={`badge ${
                      p.id === 'balanced'
                        ? 'badge-indigo'
                        : p.id === 'high'
                        ? 'badge-green'
                        : 'badge-amber'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
              )}

              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                {p.description}
              </p>

              {p.clarityNote && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '10px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#fbbf24',
                    fontSize: '0.74rem',
                  }}
                >
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  <span>{p.clarityNote}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Advanced Settings Accordion */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Sliders size={15} />
          <span>Advanced Video Settings (Resolution Downscaling)</span>
          {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showAdvanced && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#fff',
                marginBottom: '6px',
              }}
            >
              Output Resolution
            </label>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
              Resolution is preserved by default. You can optionally downscale large 4K/2K recordings to reduce file size further.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onSelectResolution('original')}
                className={selectedResolution === 'original' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                Keep Source ({sourceWidth} × {sourceHeight})
              </button>
              <button
                type="button"
                onClick={() => onSelectResolution('1080p')}
                disabled={sourceHeight < 1080 && sourceWidth < 1920}
                className={selectedResolution === '1080p' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                Downscale to 1080p Max
              </button>
              <button
                type="button"
                onClick={() => onSelectResolution('720p')}
                disabled={sourceHeight < 720 && sourceWidth < 1280}
                className={selectedResolution === '720p' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.82rem', padding: '8px 14px' }}
              >
                Downscale to 720p Max
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
