import type {
  CompressionJob,
  CompressionPreset,
  HealthResponse,
  ResolutionOption,
  VideoMetadata,
} from './types';

let currentSessionToken = '';

export function setSessionToken(token: string) {
  currentSessionToken = token;
}

export function getSessionToken(): string {
  return currentSessionToken;
}

/**
 * Checks server health and extracts session token
 */
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`Failed to check server health: ${res.statusText}`);
  }
  const data: HealthResponse = await res.json();
  if (data.sessionToken) {
    setSessionToken(data.sessionToken);
  }
  return data;
}

/**
 * Triggers native Windows OpenFileDialog for video selection
 */
export async function openFilePicker(): Promise<{ canceled: boolean; path?: string; error?: string }> {
  const res = await fetch('/api/dialog/open-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Failed to open file dialog.');
  }
  return res.json();
}

export async function cancelFileDialog(): Promise<void> {
  try {
    await fetch('/api/dialog/cancel', { method: 'POST' });
  } catch {
    // Ignore
  }
}

export interface QuickVideo {
  name: string;
  path: string;
  size: number;
  mtime: number;
  folder: string;
}

export async function fetchQuickVideos(): Promise<QuickVideo[]> {
  try {
    const res = await fetch('/api/quick-videos');
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos || [];
  } catch {
    return [];
  }
}

/**
 * Triggers native Windows FolderBrowserDialog
 */
export async function openFolderPicker(initialDir?: string): Promise<{ canceled: boolean; path?: string; error?: string }> {
  const res = await fetch('/api/dialog/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialDir }),
  });
  if (!res.ok) {
    throw new Error('Failed to open folder dialog.');
  }
  return res.json();
}

/**
 * Inspects a chosen video file using native ffprobe on the backend
 */
export async function inspectFile(filePath: string): Promise<{
  metadata: VideoMetadata;
  suggestedOutputPath: string;
}> {
  const res = await fetch('/api/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to inspect video.');
  }
  return data;
}

/**
 * Starts a compression job
 */
export async function startCompression(params: {
  sourcePath: string;
  destinationPath: string;
  preset: CompressionPreset;
  resolution?: ResolutionOption;
  allowOverwrite?: boolean;
}): Promise<CompressionJob> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': currentSessionToken,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    const error: any = new Error(data.error || 'Failed to start compression job.');
    error.code = data.code;
    error.destinationPath = data.destinationPath;
    throw error;
  }
  return data;
}

/**
 * Gets currently active or recent job
 */
export async function getActiveJob(): Promise<CompressionJob | null> {
  const res = await fetch('/api/jobs/active');
  if (!res.ok) return null;
  const data = await res.json();
  return data.job;
}

/**
 * Cancels a running compression job safely
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const res = await fetch(`/api/jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': currentSessionToken,
    },
  });
  return res.ok;
}

/**
 * Reveals the file in Windows File Explorer
 */
export async function openInExplorer(filePath: string): Promise<void> {
  await fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath }),
  });
}

/**
 * Subscribes to real-time Server-Sent Events (SSE) for a job
 */
export function subscribeToJobEvents(
  jobId: string,
  onUpdate: (job: CompressionJob) => void,
  onError?: (err: any) => void
): () => void {
  const eventSource = new EventSource(`/api/jobs/${jobId}/events`);

  eventSource.onmessage = (event) => {
    try {
      const job: CompressionJob = JSON.parse(event.data);
      onUpdate(job);
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  };

  eventSource.onerror = (err) => {
    if (onError) onError(err);
  };

  return () => {
    eventSource.close();
  };
}
