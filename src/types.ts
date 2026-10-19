export type CompressionPreset = 'high' | 'balanced' | 'small';

export type ResolutionOption = 'original' | '1080p' | '720p';

export interface VideoMetadata {
  filePath: string;
  fileName: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  bitRate?: number;
}

export type JobState =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'verifying'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface CompressionJob {
  id: string;
  sourcePath: string;
  destinationPath: string;
  preset: CompressionPreset;
  resolution: ResolutionOption;
  state: JobState;
  progress: number;
  currentTime: number;
  totalDuration: number;
  currentFps?: number;
  speed?: string;
  bitrate?: string;
  startTime: number;
  elapsedSeconds: number;
  originalSize: number;
  compressedSize?: number;
  savedBytes?: number;
  reductionPercentage?: number;
  errorMessage?: string;
  technicalLogs: string[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegVersion?: string;
  ffprobeVersion?: string;
  sessionToken: string;
  platform: string;
}
