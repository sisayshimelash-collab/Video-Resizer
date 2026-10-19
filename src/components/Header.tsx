import React from 'react';
import { ShieldCheck, Cpu, Terminal, Sparkles, HardDrive } from 'lucide-react';
import type { HealthResponse } from '../types';

interface HeaderProps {
  health: HealthResponse | null;
  onOpenDiagnostics: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, onOpenDiagnostics }) => {
  const isHealthy = health?.status === 'ok';

  return (
    <header style={{ marginBottom: '2.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Brand identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Sparkles size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                VideoSlim
              </h1>
              <span className="badge badge-indigo">Windows 11 Edition</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
              Compress videos locally. Your files stay on your PC.
            </p>
          </div>
        </div>

        {/* Engine status & Privacy badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            className={`badge ${isHealthy ? 'badge-green' : 'badge-amber'}`}
            title="Local backend process bound exclusively to loopback interface 127.0.0.1"
          >
            <ShieldCheck size={14} />
            <span>{isHealthy ? '127.0.0.1 Safe Engine' : 'Checking Engine...'}</span>
          </div>

          {health?.ffmpegVersion && (
            <div className="badge badge-indigo" title={`FFmpeg version: ${health.ffmpegVersion}`}>
              <Cpu size={14} />
              <span>FFmpeg {health.ffmpegVersion.split('-')[0]}</span>
            </div>
          )}

          <div
            className="badge badge-indigo"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            title="Zero cloud transmission: All video encoding happens on native hardware"
          >
            <HardDrive size={14} />
            <span>100% Local</span>
          </div>

          <button
            onClick={onOpenDiagnostics}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '20px' }}
            title="View technical logs and FFmpeg status"
          >
            <Terminal size={14} />
            <span>Diagnostics</span>
          </button>
        </div>
      </div>
    </header>
  );
};
