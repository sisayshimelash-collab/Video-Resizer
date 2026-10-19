/**
 * Formats bytes into human-readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats duration in seconds to HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Formats bitrate in bits/sec to Mbps or kbps
 */
export function formatBitrate(bps?: number): string {
  if (!bps || bps <= 0) return '—';
  if (bps >= 1_000_000) {
    return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  }
  return `${Math.round(bps / 1000)} kbps`;
}
