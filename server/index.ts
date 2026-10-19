import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { checkFFmpegTools, inspectVideo } from './services/ffmpegService.js';
import { jobManager } from './services/jobManager.js';
import { cancelActiveDialog, pickFolderDialog, pickVideoFileDialog } from './services/dialogService.js';
import os from 'node:os';
import {
  enforceLocalOrigin,
  generateDefaultOutputPath,
  requireSessionToken,
  SERVER_SESSION_TOKEN,
  validateDestinationPath,
  validateSourceFilePath,
} from './utils/security.js';
import type { HealthResponse } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const HOST = '127.0.0.1'; // Strictly bind to local loopback

// Security Middlewares
app.use(enforceLocalOrigin);
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// 1. Health & Environment status
app.get('/api/health', async (_req, res) => {
  const tools = await checkFFmpegTools();
  const isHealthy = tools.ffmpegAvailable && tools.ffprobeAvailable;

  const response: HealthResponse = {
    status: isHealthy ? 'ok' : 'degraded',
    ffmpegAvailable: tools.ffmpegAvailable,
    ffprobeAvailable: tools.ffprobeAvailable,
    ffmpegVersion: tools.ffmpegVersion,
    ffprobeVersion: tools.ffprobeVersion,
    sessionToken: SERVER_SESSION_TOKEN,
    platform: process.platform,
  };

  res.json(response);
});

// 2. Native File Picker Dialog
app.post('/api/dialog/open-file', async (_req, res) => {
  try {
    const result = await pickVideoFileDialog();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel active dialog
app.post('/api/dialog/cancel', (_req, res) => {
  const canceled = cancelActiveDialog();
  res.json({ success: true, canceled });
});

// 3. Quick-access recent screen recordings on user's PC
app.get('/api/quick-videos', (_req, res) => {
  const videoExtensions = new Set(['.mp4', '.mkv', '.mov', '.avi', '.webm', '.flv', '.wmv', '.m4v']);
  const searchDirs = [
    path.join(os.homedir(), 'Videos', 'Screen Recordings'),
    path.join(os.homedir(), 'Videos', 'Captures'),
    path.join(os.homedir(), 'Videos'),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Desktop'),
  ];

  const results: Array<{ name: string; path: string; size: number; mtime: number; folder: string }> = [];

  for (const dir of searchDirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (videoExtensions.has(ext)) {
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && stat.size > 0) {
              results.push({
                name: file,
                path: fullPath,
                size: stat.size,
                mtime: stat.mtimeMs,
                folder: path.basename(dir),
              });
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
  }

  // Sort by newest modified first, return top 8
  results.sort((a, b) => b.mtime - a.mtime);
  res.json({ videos: results.slice(0, 8) });
});

// 4. Native Folder Picker Dialog
app.post('/api/dialog/open-folder', async (req, res) => {
  try {
    const initialDir = typeof req.body.initialDir === 'string' ? req.body.initialDir : undefined;
    const result = await pickFolderDialog(initialDir);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Video Inspection
app.post('/api/inspect', async (req, res) => {
  const { filePath } = req.body;
  const validation = validateSourceFilePath(filePath);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const metadata = await inspectVideo(validation.normalizedPath);
    const suggestedOutputPath = generateDefaultOutputPath(validation.normalizedPath);

    res.json({
      metadata,
      suggestedOutputPath,
    });
  } catch (err: any) {
    res.status(422).json({ error: err.message });
  }
});

// 5. Start Compression Job
app.post('/api/jobs', requireSessionToken, async (req, res) => {
  const { sourcePath, destinationPath, preset, resolution = 'original', allowOverwrite = false } = req.body;

  // Validate Preset
  if (!['high', 'balanced', 'small'].includes(preset)) {
    return res.status(400).json({ error: 'Invalid preset. Must be high, balanced, or small.' });
  }

  // Validate Source
  const sourceValidation = validateSourceFilePath(sourcePath);
  if (!sourceValidation.valid) {
    return res.status(400).json({ error: sourceValidation.error });
  }

  // Validate Destination
  const destValidation = validateDestinationPath(sourceValidation.normalizedPath, destinationPath);
  if (!destValidation.valid) {
    return res.status(400).json({ error: destValidation.error });
  }

  if (destValidation.alreadyExists && !allowOverwrite) {
    return res.status(409).json({
      error: 'Destination file already exists.',
      code: 'DESTINATION_EXISTS',
      destinationPath: destValidation.normalizedPath,
    });
  }

  try {
    const sourceMeta = await inspectVideo(sourceValidation.normalizedPath);

    const job = await jobManager.startJob({
      sourcePath: sourceValidation.normalizedPath,
      destinationPath: destValidation.normalizedPath,
      preset,
      resolution,
      sourceMeta,
    });

    res.status(201).json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get Active Job
app.get('/api/jobs/active', (_req, res) => {
  const job = jobManager.getJob();
  res.json({ job });
});

// 7. Get Job Status by ID
app.get('/api/jobs/:id', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  res.json(job);
});

// 8. Server-Sent Events (SSE) Stream for real-time progress
app.get('/api/jobs/:id/events', (req, res) => {
  const jobId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  jobManager.addSSEClient(jobId, res);
});

// 9. Cancel Job
app.post('/api/jobs/:id/cancel', requireSessionToken, async (req, res) => {
  const success = await jobManager.cancelJob(req.params.id);
  if (!success) {
    return res.status(400).json({ error: 'Cannot cancel job: job not found or not currently active.' });
  }
  res.json({ success: true, message: 'Compression job cancelled.' });
});

// 10. Open in Windows Explorer
app.post('/api/open-folder', async (req, res) => {
  const { filePath } = req.body;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Valid file path required.' });
  }

  const normalized = path.normalize(path.resolve(filePath));

  try {
    if (fs.existsSync(normalized)) {
      // Highlight file in File Explorer
      spawn('explorer.exe', [`/select,${normalized}`], { shell: false });
      return res.json({ success: true });
    } else {
      const parentDir = path.dirname(normalized);
      if (fs.existsSync(parentDir)) {
        spawn('explorer.exe', [parentDir], { shell: false });
        return res.json({ success: true });
      }
      return res.status(404).json({ error: 'Path does not exist on disk.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend files in production build
const clientDist = path.resolve(process.cwd(), 'dist/client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Start Server strictly on 127.0.0.1
app.listen(PORT, HOST, () => {
  console.log(`[VideoSlim Engine] Local server bound to http://${HOST}:${PORT}`);
  console.log(`[VideoSlim Security] Session token initialized.`);
});
