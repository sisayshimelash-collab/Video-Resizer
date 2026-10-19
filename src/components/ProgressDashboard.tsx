import React, { useState } from 'react';
import { Loader2, XCircle, Gauge, Activity, Clock, Hourglass } from 'lucide-react';
import type { CompressionJob } from '../types';
import { formatDuration } from '../utils/formatters';

interface ProgressDashboardProps {
  job: CompressionJob;
  onCancel: () => Promise<void>;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ job, onCancel }) => {
  const [isCanceling, setIsCanceling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const handleCancelClick = async () => {
    try {
      setIsCanceling(true);
      await onCancel();
    } finally {
      setIsCanceling(false);
      setShowConfirmCancel(false);
    }
  };

  // Calculate ETA (estimated time remaining)
  let etaSeconds: number | null = null;
  if (job.progress > 2 && job.elapsedSeconds > 1 && job.progress < 99) {
    const totalEstSeconds = (job.elapsedSeconds / (job.progress / 100));
    etaSeconds = Math.max(0, Math.round(totalEstSeconds - job.elapsedSeconds));
  }

  const isVerifying = job.state === 'verifying';

  return (
    <div className="glass-panel" style={{ padding: '2.5rem', marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>
              {isVerifying ? 'Verifying Output Video' : 'Compressing Video...'}
            </h3>
            <span className="badge badge-indigo">
              {isVerifying ? 'Integrity Check' : 'libx264 Native'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            {isVerifying
              ? 'Checking container integrity and running ffprobe verification.'
              : 'Encoding local video without memory buffering.'}
          </p>
        </div>

        {/* Cancel Button */}
        {!showConfirmCancel ? (
          <button
            type="button"
            onClick={() => setShowConfirmCancel(true)}
            className="btn-danger"
            disabled={isCanceling}
          >
            <XCircle size={16} />
            <span>Cancel Job</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: '#fda4af' }}>Confirm cancel?</span>
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isCanceling}
              className="btn-danger"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              {isCanceling ? <Loader2 size={14} className="animate-spin" /> : 'Yes, Stop'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmCancel(false)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Resume
            </button>
          </div>
        )}
      </div>

      {/* Progress Bar Container */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '2.4rem',
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '-0.03em',
              }}
            >
              {isVerifying ? '99.9%' : `${job.progress.toFixed(1)}%`}
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              ({formatDuration(job.currentTime)} of {formatDuration(job.totalDuration)})
            </span>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Loader2 size={16} className="animate-spin" color="var(--primary)" />
            <span>{isVerifying ? 'Running ffprobe verification' : 'Active processing'}</span>
          </div>
        </div>

        {/* Bar */}
        <div
          style={{
            width: '100%',
            height: '14px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            padding: '2px',
          }}
        >
          <div
            className="shimmer-bar"
            style={{
              width: `${Math.max(2, job.progress)}%`,
              height: '100%',
              borderRadius: '9999px',
              transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Speed */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Gauge size={14} />
            <span>Speed</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {job.speed || '1.0x'}
          </div>
        </div>

        {/* Frame Rate */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Activity size={14} />
            <span>Encoding FPS</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {job.currentFps ? `${Math.round(job.currentFps)} fps` : '—'}
          </div>
        </div>

        {/* Elapsed Time */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Clock size={14} />
            <span>Elapsed</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {formatDuration(job.elapsedSeconds)}
          </div>
        </div>

        {/* Remaining ETA */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
            <Hourglass size={14} />
            <span>Est. Remaining</span>
          </div>
          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            {etaSeconds !== null ? formatDuration(etaSeconds) : 'Calculating...'}
          </div>
        </div>
      </div>
    </div>
  );
};
