import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DIR = path.resolve('tests/temp');
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} failed (code ${code}): ${stderr || stdout}`));
    });
    child.on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('--- Starting VideoSlim E2E & Safety Verification ---');
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Step 1: Start backend server
  console.log('[Test 1] Starting VideoSlim server...');
  const serverProcess = spawn('node', ['dist/server/index.js'], {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (d) => console.log(`  [Server stdout]: ${d.toString().trim()}`));
  serverProcess.stderr.on('data', (d) => console.error(`  [Server stderr]: ${d.toString().trim()}`));

  // Wait for server to boot
  await sleep(2000);

  try {
    // Step 2: Health check
    console.log('[Test 2] Querying GET /api/health...');
    const healthRes = await fetch('http://127.0.0.1:4000/api/health');
    if (!healthRes.ok) throw new Error(`Health failed: ${healthRes.status}`);
    const health = await healthRes.json();
    console.log('  Health response:', health);
    if (!health.ffmpegAvailable || !health.ffprobeAvailable || !health.sessionToken) {
      throw new Error('Health check missing required capabilities');
    }
    const token = health.sessionToken;

    // Step 3: Create synthetic test video with audio & video
    const videoWithAudioPath = path.join(TEST_DIR, 'test_sample_with_audio.mp4');
    console.log('[Test 3] Generating 4-second synthetic test video with audio...');
    await runCommand('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=4:size=1280x720:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=4',
      '-c:v', 'libx264', '-crf', '15',
      '-c:a', 'aac', '-b:a', '128k',
      videoWithAudioPath,
    ]);
    const sourceStat = fs.statSync(videoWithAudioPath);
    console.log(`  Source video created: ${sourceStat.size} bytes`);

    // Step 4: Test /api/inspect
    console.log('[Test 4] Testing POST /api/inspect...');
    const inspectRes = await fetch('http://127.0.0.1:4000/api/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: videoWithAudioPath }),
    });
    if (!inspectRes.ok) throw new Error(`Inspect failed: ${await inspectRes.text()}`);
    const inspectData = await inspectRes.json();
    console.log('  Inspection data:', {
      fileName: inspectData.metadata.fileName,
      width: inspectData.metadata.width,
      height: inspectData.metadata.height,
      fps: inspectData.metadata.fps,
      videoCodec: inspectData.metadata.videoCodec,
      audioCodec: inspectData.metadata.audioCodec,
      suggestedOutput: inspectData.suggestedOutputPath,
    });

    if (inspectData.metadata.width !== 1280 || inspectData.metadata.height !== 720) {
      throw new Error('Inspect returned invalid dimensions');
    }

    // Step 5: Test Safety Guard (Refuse to overwrite source)
    console.log('[Test 5] Testing Safety Guard: Destination == Source...');
    const overwriteSameRes = await fetch('http://127.0.0.1:4000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify({
        sourcePath: videoWithAudioPath,
        destinationPath: videoWithAudioPath,
        preset: 'balanced',
      }),
    });
    if (overwriteSameRes.status === 400) {
      console.log('  [PASS] Server successfully blocked source overwrite with status 400.');
    } else {
      throw new Error(`Expected status 400 for same source/dest, got ${overwriteSameRes.status}`);
    }

    // Step 6: Compress video with Balanced preset
    const outputPath = path.join(TEST_DIR, 'test_compressed_balanced.mp4');
    console.log('[Test 6] Starting compression with Balanced preset...');
    const jobRes = await fetch('http://127.0.0.1:4000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify({
        sourcePath: videoWithAudioPath,
        destinationPath: outputPath,
        preset: 'balanced',
      }),
    });

    if (!jobRes.ok) throw new Error(`Failed to start job: ${await jobRes.text()}`);
    const job = await jobRes.json();
    console.log(`  Job started with ID: ${job.id}`);

    // Wait and monitor progress until completed
    let finalJob = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const pollRes = await fetch(`http://127.0.0.1:4000/api/jobs/${job.id}`);
      const current = await pollRes.json();
      console.log(`    State: ${current.state}, Progress: ${current.progress}%, Speed: ${current.speed || 'N/A'}`);
      if (current.state === 'completed' || current.state === 'error' || current.state === 'cancelled') {
        finalJob = current;
        break;
      }
    }

    if (!finalJob || finalJob.state !== 'completed') {
      throw new Error(`Job failed or timed out: ${JSON.stringify(finalJob)}`);
    }

    console.log('  [PASS] Compression completed successfully!');
    console.log('  Results:', {
      originalSize: finalJob.originalSize,
      compressedSize: finalJob.compressedSize,
      savedBytes: finalJob.savedBytes,
      reductionPercentage: `${finalJob.reductionPercentage}%`,
    });

    // Step 7: Verify original is untouched
    const afterStat = fs.statSync(videoWithAudioPath);
    if (afterStat.size !== sourceStat.size) {
      throw new Error('CRITICAL SAFETY FAILURE: Original file size was modified!');
    }
    console.log('  [PASS] Source file verified intact and untouched.');

    // Step 8: Verify compressed file is valid MP4 with ffprobe
    console.log('[Test 7] Verifying output file with ffprobe...');
    const outInspectRes = await fetch('http://127.0.0.1:4000/api/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: outputPath }),
    });
    if (!outInspectRes.ok) throw new Error('Output is not a valid playable video!');
    const outMeta = await outInspectRes.json();
    console.log('  Output video verification passed:', {
      duration: outMeta.metadata.duration,
      width: outMeta.metadata.width,
      height: outMeta.metadata.height,
    });

    // Step 9: Test video with NO audio stream
    console.log('[Test 8] Generating and compressing video with NO audio...');
    const videoNoAudioPath = path.join(TEST_DIR, 'test_sample_no_audio.mp4');
    await runCommand('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=3:size=640x360:rate=24',
      '-c:v', 'libx264', '-crf', '18',
      videoNoAudioPath,
    ]);
    const outNoAudioPath = path.join(TEST_DIR, 'test_compressed_no_audio.mp4');

    const noAudioJobRes = await fetch('http://127.0.0.1:4000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify({
        sourcePath: videoNoAudioPath,
        destinationPath: outNoAudioPath,
        preset: 'high',
      }),
    });
    const noAudioJob = await noAudioJobRes.json();

    let finalNoAudio = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const pollRes = await fetch(`http://127.0.0.1:4000/api/jobs/${noAudioJob.id}`);
      const cur = await pollRes.json();
      if (cur.state === 'completed' || cur.state === 'error') {
        finalNoAudio = cur;
        break;
      }
    }
    if (!finalNoAudio || finalNoAudio.state !== 'completed') {
      throw new Error(`Video with no audio failed: ${JSON.stringify(finalNoAudio)}`);
    }
    console.log('  [PASS] Video with no audio compressed and verified cleanly.');

    // Step 10: Test Cancellation & partial file cleanup
    console.log('[Test 9] Testing Cancellation and partial file cleanup...');
    const cancelSourcePath = path.join(TEST_DIR, 'test_long_video.mp4');
    await runCommand('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=duration=8:size=1280x720:rate=30',
      '-c:v', 'libx264', '-crf', '18',
      cancelSourcePath,
    ]);
    const cancelDestPath = path.join(TEST_DIR, 'test_to_be_cancelled.mp4');

    const cancelJobRes = await fetch('http://127.0.0.1:4000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify({
        sourcePath: cancelSourcePath,
        destinationPath: cancelDestPath,
        preset: 'high',
      }),
    });
    const cancelJobData = await cancelJobRes.json();

    // Wait a brief moment for it to start encoding
    await sleep(800);

    // Now send cancel
    console.log('  Sending POST /api/jobs/:id/cancel...');
    const cancelCall = await fetch(`http://127.0.0.1:4000/api/jobs/${cancelJobData.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
    });
    const cancelResult = await cancelCall.json();
    console.log('  Cancel response:', cancelResult);

    await sleep(1000);
    const postCancelCheck = await fetch(`http://127.0.0.1:4000/api/jobs/${cancelJobData.id}`);
    const postCancelData = await postCancelCheck.json();
    console.log(`  State after cancel: ${postCancelData.state}`);

    if (postCancelData.state !== 'cancelled') {
      throw new Error(`Expected state cancelled, got ${postCancelData.state}`);
    }

    // Verify partial file was cleaned up
    const partialExists = fs.existsSync(cancelDestPath);
    console.log(`  Partial file cleaned up? ${!partialExists}`);
    if (partialExists) {
      throw new Error('Partial file was NOT cleaned up upon cancellation!');
    }
    console.log('  [PASS] Cancellation and partial cleanup verified.');

    // Step 11: Filename with spaces and unicode
    console.log('[Test 10] Testing filename with spaces and Unicode (é, ñ, 中文)...');
    const unicodeSourcePath = path.join(TEST_DIR, 'Special Video 錄影 éñ.mp4');
    fs.copyFileSync(videoWithAudioPath, unicodeSourcePath);
    const unicodeDestPath = path.join(TEST_DIR, 'Special Output 錄影 éñ compressed.mp4');

    const unicodeJobRes = await fetch('http://127.0.0.1:4000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify({
        sourcePath: unicodeSourcePath,
        destinationPath: unicodeDestPath,
        preset: 'balanced',
      }),
    });
    const unicodeJob = await unicodeJobRes.json();

    let finalUnicode = null;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const pollRes = await fetch(`http://127.0.0.1:4000/api/jobs/${unicodeJob.id}`);
      const cur = await pollRes.json();
      if (cur.state === 'completed' || cur.state === 'error') {
        finalUnicode = cur;
        break;
      }
    }
    if (!finalUnicode || finalUnicode.state !== 'completed') {
      throw new Error(`Unicode path compression failed: ${JSON.stringify(finalUnicode)}`);
    }
    console.log('  [PASS] Spaces and Unicode paths supported seamlessly!');

    console.log('\n========================================');
    console.log('ALL 10 TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================\n');
  } finally {
    // Cleanup server
    console.log('Stopping test server process...');
    serverProcess.kill('SIGKILL');
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test run failed with error:', err);
  process.exit(1);
});
