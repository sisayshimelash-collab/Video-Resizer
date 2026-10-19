# VideoSlim — Local High-Quality Video Compression App

> **Compress videos locally on Windows 11. Your files stay on your PC.**

VideoSlim is a dedicated desktop video compression tool designed specifically for educational screen recordings, coding tutorials, lectures, and slide presentations. It prioritizes the legibility of fine code fonts, UI lines, and clear audio while significantly shrinking video files.

---

## 🌟 Key Features & Architecture

* **100% Local-First Engine:** Binds strictly to `127.0.0.1`. No cloud upload, no telemetry, no tracking, and no external APIs.
* **Native FFmpeg Processing:** Directly invokes local `ffmpeg` and `ffprobe` binaries via safe argument arrays.
* **No File Buffering in RAM:** Streams file processing so recordings up to 2 GB+ compress smoothly without browser memory limits.
* **Non-Destructive Guarantee:** Original source videos are opened read-only and are **never** modified, overwritten, or deleted.
* **Accurate Progress & Live Telemetry:** Real-time percentage, elapsed time, current FPS, encoding speed, and dynamic ETA streamed via Server-Sent Events (SSE).
* **Automatic Verification:** Inspects every output video with `ffprobe` upon completion to verify container validity before reporting success.
* **Windows 11 Native Dialogs:** Open Windows File Explorer dialogs directly from the browser UI to pick videos and choose destination folders.

---

## 📋 Quality Presets

| Preset | Target CRF | Video Codec | Audio Codec | Recommended For |
| :--- | :---: | :---: | :---: | :--- |
| **High Quality** | `18` | H.264 (`libx264`) | AAC 128 kbps | Crisp code, small terminal fonts, technical slides |
| **Balanced** (Default) | `21` | H.264 (`libx264`) | AAC 128 kbps | General tutorials, lectures, screen recordings |
| **Smaller File** | `24` | H.264 (`libx264`) | AAC 128 kbps | Email attachments, chat sharing, quick drafts |

*Note: Resolution and frame rate are preserved by default. An optional advanced dropdown allows downscaling (e.g. 1080p, 720p) if desired.*

---

## 💻 Prerequisites (Windows 11)

1. **Node.js**: Version 18 or newer (tested with Node `v26.3.0` & npm `11.16.0`).
2. **Native FFmpeg & FFprobe**: Must be installed and on your system `PATH`.
   - Recommended build: [gyan.dev FFmpeg release full](https://www.gyan.dev/ffmpeg/builds/) or installed via `winget install Gyan.FFmpeg`.

### Verify Prerequisites in PowerShell:

```powershell
node -v
npm -v
ffmpeg -version
ffprobe -version
```

---

## 🚀 Quick Start (Development Mode)

1. **Install dependencies:**
   ```powershell
   npm install
   ```

2. **Start the local server and Vite client concurrently:**
   ```powershell
   npm run dev
   ```

3. Open your browser at:
   ```text
   http://127.0.0.1:5173
   ```

---

## 📦 Production Build & Run

To build and run the optimized production bundle locally:

```powershell
# Build client and server
npm run build

# Start the local production server
npm start
```
Then visit: `http://127.0.0.1:4000`

---

## 🧪 Automated Testing & Verification Report

The test suite validates the core safety and encoding requirements:

```powershell
node tests/e2e_verification.js
```

### Verification Checklist & Results

| Test Scenario | Result | Notes |
| :--- | :---: | :--- |
| **Loopback Security (`127.0.0.1`)** | **PASS** | Server binds exclusively to loopback; rejects untrusted origins |
| **Session Token Guard** | **PASS** | Cryptographic token required for all mutating endpoints (`/api/jobs`) |
| **Metadata Extraction (`ffprobe`)** | **PASS** | Accurately extracts resolution, fps, duration, audio & video streams |
| **Source Overwrite Guard** | **PASS** | Blocked with status `400` when destination path equals source path |
| **Encoding with Audio** | **PASS** | Synthetic MP4 encoded with `libx264` + `aac` and verified |
| **Source Preservation Check** | **PASS** | File size and timestamp of original file remained 100% unchanged |
| **Encoding with NO Audio** | **PASS** | Successfully compressed without missing stream failures |
| **Cancellation & Cleanup** | **PASS** | Process tree killed cleanly; partial output file safely unlinked |
| **Spaces & Unicode Paths** | **PASS** | Handled `Special Video 錄影 éñ.mp4` with no command injection |
| **Large File Readiness (2 GB)** | **VERIFIED** | Streams process directly from disk; zero file buffering in Node memory |

---

## 🛠️ Troubleshooting

- **"ffmpeg is not recognized as an internal or external command"**:
  - Add the `bin` folder containing `ffmpeg.exe` and `ffprobe.exe` to your Windows User or System `PATH` environment variable.
  - Restart PowerShell and run `ffmpeg -version`.
- **Destination file already exists**:
  - VideoSlim warns you before overwriting existing files. Choose a new name, or check the "Allow overwrite existing output" box.
- **File Picker Dialog does not appear**:
  - Check the taskbar in case the Windows file explorer dialog opened behind your browser window. You can also paste the absolute path directly into the input field.

---

## 📄 License

Personal educational and screen recording utility. All rights reserved.
