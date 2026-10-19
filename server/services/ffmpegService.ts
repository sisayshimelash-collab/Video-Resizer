import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import type { CompressionPreset, ResolutionOption, VideoMetadata } from '../types.js';

export interface FFmpegToolStatus {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegVersion?: string;
  ffprobeVersion?: string;
}

/**
 * Checks if native ffmpeg and ffprobe are installed and available on PATH
 */
export async function checkFFmpegTools(): Promise<FFmpegToolStatus> {
  const getVersion = (command: string): Promise<{ available: boolean; version?: string }> => {
    return new Promise((resolve) => {
      const child = spawn(command, ['-version'], { shell: false });
      let output = '';

      child.stdout.on('data', (d) => {
        output += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output) {
          const match = output.match(/(?:ffmpeg|ffprobe) version ([^\s]+)/i);
          resolve({
            available: true,
            version: match ? match[1] : 'installed',
          });
        } else {
          resolve({ available: false });
        }
      });

      child.on('error', () => {
        resolve({ available: false });
      });
    });
  };

  const [ffmpegRes, ffprobeRes] = await Promise.all([
    getVersion('ffmpeg'),
    getVersion('ffprobe'),
  ]);

  return {
    ffmpegAvailable: ffmpegRes.available,
    ffprobeAvailable: ffprobeRes.available,
    ffmpegVersion: ffmpegRes.version,
    ffprobeVersion: ffprobeRes.version,
  };
}

/**
 * Parses frame rate fraction (e.g. '30/1' or '60000/1001') to a rounded float
 */
function parseFrameRate(rateStr?: string): number {
  if (!rateStr) return 30;
  if (rateStr.includes('/')) {
    const [num, den] = rateStr.split('/').map(Number);
    if (den && den !== 0) {
      return Math.round((num / den) * 100) / 100;
    }
  }
  const parsed = parseFloat(rateStr);
  return isNaN(parsed) ? 30 : Math.round(parsed * 100) / 100;
}

/**
 * Inspects a local video file using ffprobe and extracts rich metadata
 */
export async function inspectVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_format',
      '-show_streams',
      '-print_format', 'json',
      filePath,
    ];

    const child = spawn('ffprobe', args, { shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`ffprobe inspection failed (code ${code}): ${stderr.trim() || 'Invalid video file'}`)
        );
      }

      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = Array.isArray(data.streams) ? data.streams : [];

        // Primary video stream
        const videoStream = streams.find((s: any) => s.codec_type === 'video');
        if (!videoStream) {
          return reject(new Error('No valid video stream detected in this file.'));
        }

        // Primary audio stream (optional)
        const audioStream = streams.find((s: any) => s.codec_type === 'audio');

        const stat = fs.statSync(filePath);
        const duration = parseFloat(format.duration || videoStream.duration || '0');
        const fps = parseFrameRate(videoStream.avg_frame_rate || videoStream.r_frame_rate);

        const metadata: VideoMetadata = {
          filePath,
          fileName: path.basename(filePath),
          fileSize: stat.size,
          duration: isNaN(duration) ? 0 : duration,
          width: parseInt(videoStream.width || '0', 10),
          height: parseInt(videoStream.height || '0', 10),
          fps,
          videoCodec: videoStream.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name,
          audioChannels: audioStream?.channels,
          audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined,
          bitRate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
        };

        resolve(metadata);
      } catch (err: any) {
        reject(new Error(`Failed to parse ffprobe metadata: ${err.message}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to execute ffprobe: ${err.message}`));
    });
  });
}

/**
 * Builds the exact array of arguments for native ffmpeg invocation
 */
export function buildFFmpegArgs(options: {
  sourcePath: string;
  destinationPath: string;
  preset: CompressionPreset;
  resolution?: ResolutionOption;
  hasAudio: boolean;
}): string[] {
  const { sourcePath, destinationPath, preset, resolution, hasAudio } = options;

  // CRF preset settings
  const crfMap: Record<CompressionPreset, string> = {
    high: '18',
    balanced: '21',
    small: '24',
  };

  const args: string[] = [
    '-hide_banner',
    '-y',
    '-i', sourcePath,
    '-map', '0:v:0',
  ];

  // Optional audio mapping
  if (hasAudio) {
    args.push('-map', '0:a?');
  }

  // Video codec parameters
  args.push(
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', crfMap[preset] || '21'
  );

  // Optional downscaling filter (never upscale)
  if (resolution === '1080p') {
    args.push('-vf', 'scale=w=\'min(1920,iw)\':h=\'min(1080,ih)\':force_original_aspect_ratio=decrease:flags=bicubic');
  } else if (resolution === '720p') {
    args.push('-vf', 'scale=w=\'min(1280,iw)\':h=\'min(720,ih)\':force_original_aspect_ratio=decrease:flags=bicubic');
  }

  // Audio codec parameters
  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '128k');
  }

  // Web-optimized MP4 container
  args.push(
    '-movflags', '+faststart',
    '-progress', 'pipe:1',
    '-nostats',
    destinationPath
  );

  return args;
}

/**
 * Verifies that the compressed output file exists, is non-empty, and passes ffprobe check
 */
export async function verifyOutputVideo(
  destinationPath: string,
  minExpectedDuration: number = 0
): Promise<{ success: boolean; size: number; duration: number; error?: string }> {
  try {
    if (!fs.existsSync(destinationPath)) {
      return { success: false, size: 0, duration: 0, error: 'Output file does not exist on disk.' };
    }

    const stat = fs.statSync(destinationPath);
    if (stat.size === 0) {
      return { success: false, size: 0, duration: 0, error: 'Output file is 0 bytes.' };
    }

    // Run ffprobe check on the output
    const meta = await inspectVideo(destinationPath);
    if (meta.width <= 0 || meta.height <= 0) {
      return { success: false, size: stat.size, duration: meta.duration, error: 'Output has invalid video dimensions.' };
    }

    if (minExpectedDuration > 2 && meta.duration < 1) {
      return {
        success: false,
        size: stat.size,
        duration: meta.duration,
        error: `Output video duration (${meta.duration}s) is significantly shorter than source.`,
      };
    }

    return {
      success: true,
      size: stat.size,
      duration: meta.duration,
    };
  } catch (err: any) {
    return {
      success: false,
      size: 0,
      duration: 0,
      error: `Output verification failed: ${err.message}`,
    };
  }
}
