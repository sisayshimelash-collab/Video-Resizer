import React from 'react';
import { X, Terminal, Cpu, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { CompressionJob, HealthResponse } from '../types';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  health: HealthResponse | null;
  currentJob: CompressionJob | null;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  onClose,
  health,
  currentJob,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '580px',
          height: '100%',
          borderRadius: 0,
          borderLeft: '1px solid var(--border-subtle)',
          padding: '2rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
              System & Diagnostics
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Environment Status */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} />
            <span>Local Engine & Tools</span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>FFmpeg Version:</span>
              <span className="font-mono" style={{ color: '#fff' }}>
                {health?.ffmpegVersion || 'Not Detected'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>FFprobe Version:</span>
              <span className="font-mono" style={{ color: '#fff' }}>
                {health?.ffprobeVersion || 'Not Detected'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Operating System:</span>
              <span className="font-mono" style={{ color: '#fff' }}>
                Windows 11 ({health?.platform})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-dim)' }}>Binding Address:</span>
              <span className="font-mono" style={{ color: '#34d399' }}>
                127.0.0.1 (Strict Loopback)
              </span>
            </div>
          </div>
        </div>

        {/* Security Checklist */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} />
            <span>Privacy & Security Guarantees</span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} color="#34d399" />
              <span>Zero external video streaming or upload endpoints</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} color="#34d399" />
              <span>Spawn with argument array: Protected against shell injection</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} color="#34d399" />
              <span>Original source video is read-only and never modified</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} color="#34d399" />
              <span>Per-session cryptographic token on state-changing API routes</span>
            </div>
          </div>
        </div>

        {/* FFmpeg Logs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
            Execution Logs (FFmpeg stderr / events)
          </h4>
          <div
            className="font-mono"
            style={{
              flex: 1,
              minHeight: '220px',
              maxHeight: '340px',
              background: '#04060a',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              fontSize: '0.74rem',
              color: '#94a3b8',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
          >
            {currentJob?.technicalLogs && currentJob.technicalLogs.length > 0 ? (
              currentJob.technicalLogs.join('\n')
            ) : (
              <span style={{ color: 'var(--text-dim)' }}>
                No active compression logs. Logs will appear here during encoding.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
