# VideoSlim — Local Video Compression App
## Agent Implementation Brief

## 1. Goal

Build a simple, reliable **local-only video compression tool** for Windows 11. The user should be able to select large recordings from their PC, compress them while prioritizing visual quality, and save the smaller output locally.

This is a personal tool for educational screen recordings. Text, code, slides, diagrams, and voice must remain clear. The original file must never be modified or deleted.

**Do not build a public website, cloud service, account system, database, analytics, or video upload API.** Everything must run on the user's own PC.

## 2. Important architecture decision

Use a **local web UI with a local Node.js backend that invokes native FFmpeg**, rather than relying on FFmpeg.wasm as the primary encoder.

Why:
- The user wants to process very large local files, potentially up to 2 GB.
- FFmpeg.wasm can hit browser/WebAssembly memory and filesystem limits for large inputs and outputs.
- Native FFmpeg is generally more practical and efficient for large files.
- The video never needs to be uploaded to a remote server.

Architecture:

```text
Windows 11 PC
  ├── React + TypeScript + Vite UI (localhost only)
  ├── Node.js + Express local API (127.0.0.1 only)
  ├── Native FFmpeg / ffprobe installed on the PC
  └── Source and output videos remain on local disk
```

The Node backend should bind to `127.0.0.1`, not `0.0.0.0`. Do not expose it to the local network or public internet.

## 3. Preferred stack

- Frontend: React, TypeScript, Vite
- Styling: Tailwind CSS if it is already part of the project; otherwise use simple CSS
- Backend: Node.js and Express
- Video processing: native `ffmpeg` and `ffprobe` command-line tools
- Process management: Node `child_process.spawn` (not shell-concatenated commands)
- Frontend/backend communication: local HTTP API and Server-Sent Events (SSE), or another simple reliable progress channel
- Package manager: use the package manager already present in the repository; if starting fresh, use npm

Before installing dependencies, inspect the repository and existing environment. Do not overwrite an existing project without understanding it.

## 4. User workflow

1. User opens the local app.
2. User selects a video file from the computer.
3. App displays filename, file size, duration, resolution, frame rate, video codec, and audio information when available.
4. User chooses a quality preset.
5. User chooses an output folder and optional output filename.
6. User starts compression.
7. App displays progress, elapsed time, and current processing state.
8. User can cancel a running job.
9. When finished, app displays original size, output size, saved bytes, and percentage reduction.
10. User can open the output folder or compress another video.

Keep the UI straightforward and responsive. No login, registration, database, or cloud storage.

## 5. Quality and compression requirements

Prioritize visual quality over reaching an arbitrary file size. Do not promise zero quality loss when using lossy compression.

Provide these presets:

### High Quality
- Video: H.264 (`libx264`)
- CRF: 18
- Preset: `medium`
- Audio: AAC at 128 kbps when audio exists
- Preserve source resolution and frame rate by default

### Balanced
- Video: H.264 (`libx264`)
- CRF: 21
- Preset: `medium`
- Audio: AAC at 128 kbps when audio exists
- Preserve source resolution and frame rate by default

### Smaller File
- Video: H.264 (`libx264`)
- CRF: 24
- Preset: `medium`
- Audio: AAC at 128 kbps when audio exists
- Warn that small text and thin lines may lose clarity; allow preview/test clip if feasible

These are starting settings, not guarantees. Do not silently reduce resolution or frame rate. Make any resolution reduction an explicit, optional advanced setting, disabled by default.

For the first version, use MP4 output with H.264 video and AAC audio for broad compatibility. If the source has no audio, the command must still succeed.

Use `ffprobe` to inspect the source before encoding. Handle missing or unusual metadata gracefully.

Use FFmpeg progress output (`-progress pipe:1` where suitable) and parse it to show meaningful progress. Do not fake progress percentages. If total duration is unavailable, show an indeterminate progress indicator.

Do not use a shell command string with user-supplied paths. Use `spawn(executable, args, { shell: false })` to avoid command injection. Handle paths with spaces and Unicode.

## 6. Local file handling

- All selected source files remain where the user originally stored them.
- Never overwrite, rename, truncate, or delete the source.
- Default the output filename to `<original-name>-compressed.mp4`.
- If the output path already exists, ask the user to choose another name or create a safe unique filename. Never overwrite silently.
- Let the user select an output directory.
- Do not read the entire video into Node memory. Pass the file path to native FFmpeg.
- Do not upload file contents, filenames, paths, thumbnails, or metadata anywhere.
- Do not add telemetry, analytics, external APIs, or remote processing.
- Clearly show the selected source and destination paths in the UI.
- Clean up only app-created temporary files. Never delete user files.

For the initial version, a local file picker can return a path to the backend through a controlled local API. Validate that the path exists and is a regular file. Since the app is local-only, do not expose a generic arbitrary-command endpoint. Keep API operations narrow: inspect a video, start a compression job, check job status, cancel a job, and reveal/open the output location if supported.

If using an Electron shell is simpler or safer for file selection and output-folder selection, explain the trade-offs before changing architecture. Do not silently turn this into a hosted web app.

## 7. Local security requirements

- Bind the backend to `127.0.0.1` only.
- Use a random per-session token or equivalent local request protection for state-changing API routes, and validate the `Origin`/Host where appropriate.
- Do not expose an endpoint that executes arbitrary commands.
- Use fixed, allowlisted FFmpeg arguments derived from validated options.
- Validate quality presets and paths on the backend; never trust frontend validation alone.
- Restrict CORS to the local frontend origin. Do not use permissive `*` CORS.
- Add request size limits for JSON/API requests. Video bytes should never be sent through the API.
- Avoid logging full local paths by default; do not log sensitive metadata unnecessarily.
- Handle process crashes, malformed files, unsupported codecs, and cancellation safely.
- Document that the app is intended for local use and must not be exposed through a tunnel or public reverse proxy.

## 8. API design

Keep the API small. Suggested routes:

- `GET /api/health`
  - Reports that the local server is running and whether `ffmpeg`/`ffprobe` are available.

- `POST /api/inspect`
  - Input: selected local file path.
  - Runs `ffprobe` and returns sanitized metadata.

- `POST /api/jobs`
  - Input: source path, destination path, and an allowlisted preset (`high`, `balanced`, `small`).
  - Validates source/destination, checks that output does not overwrite source, starts an FFmpeg process, and returns a job ID.

- `GET /api/jobs/:id`
  - Returns state, real progress if available, elapsed time, and any user-safe error message.

- `GET /api/jobs/:id/events`
  - Optional SSE stream for progress updates.

- `POST /api/jobs/:id/cancel`
  - Stops the process safely and marks the job cancelled.

Do not create endpoints for file upload, arbitrary command execution, account management, or remote storage.

## 9. FFmpeg implementation guidance

Use `ffprobe` JSON output to inspect streams and duration. Use `spawn` with argument arrays. For compression, a typical H.264 command can resemble:

```bash
ffmpeg -hide_banner -y -i INPUT \
  -map 0:v:0 -map 0:a? \
  -c:v libx264 -preset medium -crf 18 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  -progress pipe:1 -nostats OUTPUT.mp4
```

Implementation notes:
- Build the argument array in code; do not execute this as a shell string.
- The `-y` option must only be used after the backend has safely reserved a new, non-existing output path. Prefer avoiding overwrite flags if feasible.
- Handle sources with no audio.
- Preserve rotation/orientation correctly.
- Consider subtitles, multiple audio streams, HDR, variable frame rate, and unusual codecs. For the MVP, clearly document any stream types that are not preserved. Do not silently claim full fidelity for every media type.
- Do not use `-c:v copy` as the main compression method; stream copying generally does not reduce video size.
- For progress, parse FFmpeg's `out_time`/`out_time_ms` or another documented progress field and compare with source duration.
- On cancellation, terminate the FFmpeg process and confirm it has exited before marking cleanup complete.
- Keep partial output files clearly marked and remove them only if the app can confidently identify them as created by the cancelled/failed job.
- Verify the output exists and has a nonzero size before reporting success.
- Run a final `ffprobe` check on the output and report errors if it is not readable.

## 10. Large-file and performance requirements

The first target is a 2 GB source file, but actual processing depends on available disk space, source codec, duration, and CPU speed.

- Use native FFmpeg to avoid loading entire videos into browser memory.
- Stream process output; do not buffer the encoded file in Node.
- Ensure the destination drive has enough free space when that check is available.
- Warn users that processing may take longer than the video's duration.
- Permit one job at a time for the MVP.
- Keep the interface responsive during long jobs.
- Test a short file first, then larger test files (for example 500 MB, 1 GB, and 2 GB).
- Do not claim a guaranteed percentage reduction. Some already-compressed recordings may barely shrink or may grow.
- Do not automatically delete original files after successful compression.

## 11. Error handling

Show understandable messages for:
- FFmpeg or ffprobe not installed / not found
- Unsupported or corrupt input
- Missing source file
- Invalid destination or permission denied
- Output path already exists
- Not enough disk space, when detectable
- Compression failure
- User cancellation
- Output verification failure

Include technical diagnostic details in a collapsible section or local log, but avoid dumping huge FFmpeg logs into the UI.

## 12. UI design

A clean single-page interface:

- App title: `VideoSlim`
- Subtitle: `Compress videos locally. Your files stay on your PC.`
- Large drag-and-drop / browse area
- Selected video information card
- Preset selector with concise explanations
- Output folder and filename fields
- Start compression button
- Progress bar and current status
- Results card showing:
  - Original size
  - Compressed size
  - Space saved
  - Percentage reduction
  - Output location
- Actions: `Open output folder`, `Compress another`, `Cancel`

Make the privacy claim accurate: processing is local and the application itself does not upload files. If any external resources are loaded at runtime, disclose them or bundle them locally.

## 13. Windows setup and developer experience

Provide a clear README with:
1. Requirements: supported Windows version, Node.js version, and native FFmpeg/ffprobe.
2. How to install FFmpeg and confirm `ffmpeg -version` and `ffprobe -version` work in PowerShell.
3. Dependency installation.
4. How to run the frontend and backend locally.
5. Troubleshooting common Windows path and permission issues.
6. How to build and run the production version locally.

Provide scripts such as:

```json
{
  "scripts": {
    "dev": "concurrently ...",
    "dev:client": "vite",
    "dev:server": "node server/index.js",
    "build": "vite build",
    "start": "node server/index.js"
  }
}
```

Adapt the actual scripts to the final project structure and install only necessary dependencies.

## 14. Testing checklist

At minimum, verify:

- MP4 with video and audio
- MP4 with no audio
- A filename with spaces and Unicode characters
- A source path and destination path with spaces
- Output file already exists
- Invalid/corrupt file
- Missing FFmpeg executable
- Cancellation during compression
- Process failure leaves the original untouched
- Successful output is playable and passes `ffprobe`
- Output size and savings are calculated correctly
- UI remains responsive during processing
- No video data is sent to any remote host
- Large-file processing works without loading video bytes into browser or Node memory

## 15. Definition of done

The MVP is complete when:

1. The user can run the app locally on Windows 11.
2. The app can inspect and compress a local video using the three presets.
3. The original file is never changed.
4. Output is saved locally to the chosen destination.
5. Progress, cancellation, and errors work.
6. The output is verified before success is shown.
7. The app does not upload or transmit videos.
8. The README explains installation, FFmpeg setup, usage, limitations, and troubleshooting.
9. A test report documents the largest file successfully tested and the approximate processing time.
10. No claims of “zero quality loss” or guaranteed compression ratios are made for lossy presets.

## 16. Instructions to the coding agent

- First inspect the current repository and environment.
- Briefly report the proposed structure and any existing code you can reuse.
- Implement a working MVP, not just mockups or pseudocode.
- Prefer simple, maintainable code over unnecessary abstractions.
- Do not deploy it publicly.
- Do not add cloud services, analytics, authentication, or a database.
- Do not make the user upload files.
- Do not overwrite or delete original videos.
- Run available tests and build checks.
- Finish by giving exact PowerShell commands to install prerequisites, start the app, and use it.
- Clearly state what was tested and what remains unverified, especially 2 GB processing.
