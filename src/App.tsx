import React, { useState, useEffect, useRef } from 'react';
import {
  cancelJob,
  getActiveJob,
  getHealth,
  inspectFile,
  startCompression,
  subscribeToJobEvents,
} from './api';
import type {
  CompressionJob,
  CompressionPreset,
  HealthResponse,
  ResolutionOption,
  VideoMetadata,
} from './types';
import { Header } from './components/Header';
import { FileSelector } from './components/FileSelector';
import { MetadataCard } from './components/MetadataCard';
import { PresetSelector } from './components/PresetSelector';
import { DestinationConfig } from './components/DestinationConfig';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ResultsCard } from './components/ResultsCard';
import { DiagnosticsDrawer } from './components/DiagnosticsDrawer';
import { Play, AlertCircle, ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<VideoMetadata | null>(null);
  const [outputPath, setOutputPath] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<CompressionPreset>('balanced');
  const [selectedResolution, setSelectedResolution] = useState<ResolutionOption>('original');
  const [allowOverwrite, setAllowOverwrite] = useState<boolean>(false);
  const [isConflict, setIsConflict] = useState<boolean>(false);

  const [currentJob, setCurrentJob] = useState<CompressionJob | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [isStartingJob, setIsStartingJob] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  const sseUnsubscribeRef = useRef<(() => void) | null>(null);

  // Initial health check & active job resumption
  useEffect(() => {
    const checkHealth = () => {
      getHealth()
        .then((data) => setHealth(data))
        .catch((err) => console.error('Failed to connect to backend engine:', err));
    };

    checkHealth();
    const interval = setInterval(checkHealth, 3000);

    getActiveJob().then((job) => {
      if (job && (job.state === 'processing' || job.state === 'verifying')) {
        setCurrentJob(job);
        setupSSE(job.id);
      }
    });

    return () => {
      clearInterval(interval);
      if (sseUnsubscribeRef.current) {
        sseUnsubscribeRef.current();
      }
    };
  }, []);

  const setupSSE = (jobId: string) => {
    if (sseUnsubscribeRef.current) {
      sseUnsubscribeRef.current();
    }

    sseUnsubscribeRef.current = subscribeToJobEvents(
      jobId,
      (updatedJob) => {
        setCurrentJob(updatedJob);
        if (updatedJob.state === 'error' && updatedJob.errorMessage) {
          setErrorMessage(updatedJob.errorMessage);
        }
      },
      (err) => console.error('SSE Error:', err)
    );
  };

  const handleSelectFile = async (filePath: string) => {
    setErrorMessage(null);
    setIsInspecting(true);
    try {
      const res = await inspectFile(filePath);
      setSourceMetadata(res.metadata);
      setOutputPath(res.suggestedOutputPath);
      setIsConflict(false);
      setAllowOverwrite(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to inspect file.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleStartCompression = async () => {
    if (!sourceMetadata || !outputPath) return;
    setErrorMessage(null);
    setIsStartingJob(true);

    try {
      const job = await startCompression({
        sourcePath: sourceMetadata.filePath,
        destinationPath: outputPath,
        preset: selectedPreset,
        resolution: selectedResolution,
        allowOverwrite,
      });

      setCurrentJob(job);
      setupSSE(job.id);
    } catch (err: any) {
      if (err.code === 'DESTINATION_EXISTS') {
        setIsConflict(true);
      } else {
        setErrorMessage(err.message || 'Failed to start compression job.');
      }
    } finally {
      setIsStartingJob(false);
    }
  };

  const handleCancelJob = async () => {
    if (!currentJob) return;
    try {
      await cancelJob(currentJob.id);
    } catch (err: any) {
      console.error('Cancel error:', err);
    }
  };

  const handleCompressAnother = () => {
    if (sseUnsubscribeRef.current) {
      sseUnsubscribeRef.current();
    }
    setCurrentJob(null);
    setSourceMetadata(null);
    setOutputPath('');
    setIsConflict(false);
    setAllowOverwrite(false);
    setErrorMessage(null);
  };

  const isJobActive =
    currentJob &&
    (currentJob.state === 'processing' || currentJob.state === 'verifying' || currentJob.state === 'queued');

  const isJobCompleted = currentJob && currentJob.state === 'completed';

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.25rem 4rem 1.25rem' }}>
      <Header health={health} onOpenDiagnostics={() => setShowDiagnostics(true)} />

      {/* Global Error Banner */}
      {errorMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            color: '#fda4af',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* View 1: Active Progress Dashboard */}
      {isJobActive && (
        <ProgressDashboard job={currentJob} onCancel={handleCancelJob} />
      )}

      {/* View 2: Completed Results */}
      {isJobCompleted && (
        <ResultsCard job={currentJob} onCompressAnother={handleCompressAnother} />
      )}

      {/* View 3: Configuration & Start View (When not actively compressing and not showing final results) */}
      {!isJobActive && !isJobCompleted && (
        <>
          {!sourceMetadata ? (
            <FileSelector
              onFileSelect={handleSelectFile}
              isLoading={isInspecting}
              error={errorMessage}
            />
          ) : (
            <div>
              {/* Back to selection */}
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setSourceMetadata(null)}
                  className="btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  <ArrowLeft size={14} />
                  <span>Choose Different Video</span>
                </button>
              </div>

              {/* Source Video Metadata Card */}
              <MetadataCard
                metadata={sourceMetadata}
                onChangeFile={() => setSourceMetadata(null)}
              />

              {/* Preset Selector */}
              <PresetSelector
                selectedPreset={selectedPreset}
                onSelectPreset={setSelectedPreset}
                selectedResolution={selectedResolution}
                onSelectResolution={setSelectedResolution}
                sourceWidth={sourceMetadata.width}
                sourceHeight={sourceMetadata.height}
              />

              {/* Destination Configuration */}
              <DestinationConfig
                sourcePath={sourceMetadata.filePath}
                outputPath={outputPath}
                onChangeOutputPath={(newPath) => {
                  setOutputPath(newPath);
                  setIsConflict(false);
                }}
                allowOverwrite={allowOverwrite}
                onToggleAllowOverwrite={setAllowOverwrite}
                isConflict={isConflict}
              />

              {/* Primary Action Button */}
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={handleStartCompression}
                  disabled={
                    isStartingJob ||
                    !outputPath ||
                    sourceMetadata.filePath.trim().toLowerCase() === outputPath.trim().toLowerCase()
                  }
                  className="btn-primary"
                  style={{
                    padding: '16px 40px',
                    fontSize: '1.15rem',
                    borderRadius: 'var(--radius-lg)',
                    minWidth: '280px',
                  }}
                >
                  <Play size={20} fill="#ffffff" />
                  <span>{isStartingJob ? 'Initializing...' : 'Start Video Compression'}</span>
                </button>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '10px' }}>
                  Processing is done via native FFmpeg. Your source video will remain 100% untouched.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Diagnostics Drawer */}
      <DiagnosticsDrawer
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        health={health}
        currentJob={currentJob}
      />
    </div>
  );
};
