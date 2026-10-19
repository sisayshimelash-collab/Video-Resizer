import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Response } from 'express';
import type { CompressionJob, CompressionPreset, ResolutionOption, VideoMetadata } from '../types.js';
import { buildFFmpegArgs, verifyOutputVideo } from './ffmpegService.js';

class JobManager {
  private activeJob: CompressionJob | null = null;
  private sseClients: Map<string, Set<Response>> = new Map();
  private partialFileCreatedByJob: Set<string> = new Set();

  /**
   * Returns current active or last processed job
   */
  public getJob(id?: string): CompressionJob | null {
    if (!this.activeJob) return null;
    if (id && this.activeJob.id !== id) return null;
    return this.serializeJob(this.activeJob);
  }

  /**
   * Starts a new compression job
   */
  public async startJob(params: {
    sourcePath: string;
    destinationPath: string;
    preset: CompressionPreset;
    resolution?: ResolutionOption;
    sourceMeta: VideoMetadata;
  }): Promise<CompressionJob> {
    if (this.activeJob && (this.activeJob.state === 'processing' || this.activeJob.state === 'verifying')) {
      throw new Error('A compression job is already actively running. VideoSlim allows one job at a time.');
    }

    const { sourcePath, destinationPath, preset, resolution = 'original', sourceMeta } = params;
    const jobId = crypto.randomUUID();

    const job: CompressionJob = {
      id: jobId,
      sourcePath,
      destinationPath,
      preset,
      resolution,
      state: 'queued',
      progress: 0,
      currentTime: 0,
      totalDuration: sourceMeta.duration,
      startTime: Date.now(),
      elapsedSeconds: 0,
      originalSize: sourceMeta.fileSize,
      technicalLogs: [],
    };

    this.activeJob = job;
    this.broadcast(job);

    // Build FFmpeg args
    const ffmpegArgs = buildFFmpegArgs({
      sourcePath,
      destinationPath,
      preset,
      resolution,
      hasAudio: Boolean(sourceMeta.audioCodec),
    });

    job.technicalLogs.push(`[${new Date().toLocaleTimeString()}] Starting FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);

    // Record partial destination to clean up on error/cancel
    this.partialFileCreatedByJob.add(path.resolve(destinationPath).toLowerCase());

    // Spawn native FFmpeg process without shell
    const child = spawn('ffmpeg', ffmpegArgs, {
      shell: false,
      windowsHide: true,
    });

    job.childProcess = child;
    job.state = 'processing';
    this.broadcast(job);

    let progressBuffer = '';

    // Parse progress output from pipe:1
    child.stdout.on('data', (chunk: Buffer) => {
      progressBuffer += chunk.toString();
      const lines = progressBuffer.split('\n');
      progressBuffer = lines.pop() || '';

      let updated = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;

        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();

        if (key === 'out_time_us') {
          const us = parseInt(val, 10);
          if (!isNaN(us)) {
            const currentSec = us / 1_000_000;
            job.currentTime = currentSec;
            if (job.totalDuration > 0) {
              const pct = (currentSec / job.totalDuration) * 100;
              job.progress = Math.min(99.5, Math.max(0, Math.round(pct * 10) / 10));
            }
            updated = true;
          }
        } else if (key === 'fps') {
          const fps = parseFloat(val);
          if (!isNaN(fps)) job.currentFps = fps;
        } else if (key === 'speed') {
          job.speed = val;
        } else if (key === 'bitrate') {
          job.bitrate = val;
        }
      }

      job.elapsedSeconds = Math.floor((Date.now() - job.startTime) / 1000);

      if (updated) {
        this.broadcast(job);
      }
    });

    // Capture technical logs from stderr
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      for (const l of lines) {
        if (job.technicalLogs.length > 50) {
          job.technicalLogs.shift();
        }
        job.technicalLogs.push(l.trim());
      }
    });

    child.on('close', async (code) => {
      job.childProcess = undefined;

      // Handle cancellation
      if (job.state === 'cancelled') {
        await this.safeCleanupPartialFile(destinationPath);
        this.broadcast(job);
        return;
      }

      // Handle exit code
      if (code !== 0) {
        job.state = 'error';
        job.errorMessage = `FFmpeg exited with error code ${code}. Check diagnostics for details.`;
        await this.safeCleanupPartialFile(destinationPath);
        this.broadcast(job);
        return;
      }

      // Verification phase
      job.state = 'verifying';
      job.progress = 99.9;
      this.broadcast(job);

      const verification = await verifyOutputVideo(destinationPath, job.totalDuration);
      if (!verification.success) {
        job.state = 'error';
        job.errorMessage = verification.error || 'Output file verification failed.';
        await this.safeCleanupPartialFile(destinationPath);
        this.broadcast(job);
        return;
      }

      // Verification passed: calculate savings
      job.state = 'completed';
      job.progress = 100;
      job.compressedSize = verification.size;
      job.savedBytes = Math.max(0, job.originalSize - verification.size);
      job.reductionPercentage =
        job.originalSize > 0
          ? Math.round(((job.originalSize - verification.size) / job.originalSize) * 1000) / 10
          : 0;
      job.elapsedSeconds = Math.floor((Date.now() - job.startTime) / 1000);

      this.partialFileCreatedByJob.delete(path.resolve(destinationPath).toLowerCase());
      this.broadcast(job);
    });

    child.on('error', async (err) => {
      job.state = 'error';
      job.errorMessage = `Failed to launch FFmpeg: ${err.message}`;
      await this.safeCleanupPartialFile(destinationPath);
      this.broadcast(job);
    });

    return this.serializeJob(job);
  }

  /**
   * Safely cancels an active compression job
   */
  public async cancelJob(jobId: string): Promise<boolean> {
    if (!this.activeJob || this.activeJob.id !== jobId) {
      return false;
    }

    const job = this.activeJob;
    if (job.state !== 'processing' && job.state !== 'queued' && job.state !== 'verifying') {
      return false;
    }

    job.state = 'cancelled';
    job.errorMessage = 'Job was cancelled by the user.';

    if (job.childProcess && !job.childProcess.killed) {
      const child = job.childProcess;
      const pid = child.pid;

      await new Promise<void>((resolve) => {
        const onExit = () => resolve();
        child.once('close', onExit);
        child.once('exit', onExit);

        if (pid) {
          spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { shell: false });
        } else {
          child.kill('SIGKILL');
        }

        // Safety fallback timeout
        setTimeout(resolve, 2000);
      });
    }

    await this.safeCleanupPartialFile(job.destinationPath);
    this.broadcast(job);
    return true;
  }

  /**
   * Safely removes partial output file ONLY if created by this compression job
   */
  private async safeCleanupPartialFile(destPath: string): Promise<boolean> {
    const normalized = path.resolve(destPath).toLowerCase();
    if (!this.partialFileCreatedByJob.has(normalized)) {
      return false;
    }

    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        if (!fs.existsSync(destPath)) {
          this.partialFileCreatedByJob.delete(normalized);
          return true;
        }
        fs.unlinkSync(destPath);
        this.partialFileCreatedByJob.delete(normalized);
        return true;
      } catch {
        // Wait 150ms for Windows file lock release before retrying
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    if (!fs.existsSync(destPath)) {
      this.partialFileCreatedByJob.delete(normalized);
      return true;
    }
    return false;
  }

  /**
   * Subscribes an SSE client response stream to job updates
   */
  public addSSEClient(jobId: string, res: Response) {
    if (!this.sseClients.has(jobId)) {
      this.sseClients.set(jobId, new Set());
    }
    const clients = this.sseClients.get(jobId)!;
    clients.add(res);

    // Send immediate initial status if this job is active
    if (this.activeJob && this.activeJob.id === jobId) {
      res.write(`data: ${JSON.stringify(this.serializeJob(this.activeJob))}\n\n`);
    }

    res.on('close', () => {
      clients.delete(res);
      if (clients.size === 0) {
        this.sseClients.delete(jobId);
      }
    });
  }

  /**
   * Broadcasts job state to all connected SSE clients
   */
  private broadcast(job: CompressionJob) {
    const clients = this.sseClients.get(job.id);
    if (!clients || clients.size === 0) return;

    const payload = `data: ${JSON.stringify(this.serializeJob(job))}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch {
        clients.delete(res);
      }
    }
  }

  /**
   * Serializes a job without non-serializable ChildProcess
   */
  private serializeJob(job: CompressionJob): CompressionJob {
    const { childProcess, ...rest } = job;
    return rest as CompressionJob;
  }
}

export const jobManager = new JobManager();
