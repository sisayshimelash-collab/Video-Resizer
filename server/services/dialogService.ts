import { spawn, type ChildProcess } from 'node:child_process';

export interface DialogResult {
  canceled: boolean;
  path?: string;
  error?: string;
}

let activeDialogProcess: ChildProcess | null = null;

function encodePowerShellScript(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/**
 * Force cancel any currently open PowerShell dialog
 */
export function cancelActiveDialog(): boolean {
  if (activeDialogProcess) {
    try {
      if (activeDialogProcess.pid) {
        spawn('taskkill', ['/pid', activeDialogProcess.pid.toString(), '/T', '/F'], { shell: false });
      } else {
        activeDialogProcess.kill('SIGKILL');
      }
    } catch {
      // Ignore
    }
    activeDialogProcess = null;
    return true;
  }
  return false;
}

/**
 * Opens native Windows OpenFileDialog with TopMost foreground form via EncodedCommand
 */
export async function pickVideoFileDialog(): Promise<DialogResult> {
  // Cancel previous if any
  cancelActiveDialog();

  return new Promise((resolve) => {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "Select Video File - VideoSlim"
$dialog.Filter = "Video Files (*.mp4;*.mkv;*.mov;*.avi;*.webm;*.flv;*.wmv;*.m4v;*.ts)|*.mp4;*.mkv;*.mov;*.avi;*.webm;*.flv;*.wmv;*.m4v;*.ts|All Files (*.*)|*.*"
$dialog.RestoreDirectory = $true

$result = $dialog.ShowDialog($form)
$form.Dispose()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.FileName
} else {
    Write-Output "__CANCELED__"
}
`.trim();

    const encoded = encodePowerShellScript(script);

    const ps = spawn('powershell', ['-sta', '-NoProfile', '-EncodedCommand', encoded], {
      windowsHide: false,
    });

    activeDialogProcess = ps;

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      cancelActiveDialog();
      resolve({ canceled: true, error: 'Dialog timed out.' });
    }, 180000);

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      clearTimeout(timer);
      activeDialogProcess = null;

      if (code !== 0 && code !== null) {
        return resolve({ canceled: true, error: stderr.trim() || 'Dialog closed or failed.' });
      }

      const result = stdout.trim();
      if (!result || result === '__CANCELED__') {
        return resolve({ canceled: true });
      }

      resolve({ canceled: false, path: result });
    });

    ps.on('error', (err) => {
      clearTimeout(timer);
      activeDialogProcess = null;
      resolve({ canceled: true, error: err.message });
    });
  });
}

/**
 * Opens native Windows FolderBrowserDialog with TopMost foreground form via EncodedCommand
 */
export async function pickFolderDialog(initialDir?: string): Promise<DialogResult> {
  cancelActiveDialog();

  return new Promise((resolve) => {
    const safeInitial = initialDir ? initialDir.replace(/'/g, "''") : '';
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select Destination Folder for Compressed Video"
$dialog.ShowNewFolderButton = $true
${safeInitial ? `if (Test-Path '${safeInitial}') { $dialog.SelectedPath = '${safeInitial}' }` : ''}

$result = $dialog.ShowDialog($form)
$form.Dispose()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
} else {
    Write-Output "__CANCELED__"
}
`.trim();

    const encoded = encodePowerShellScript(script);

    const ps = spawn('powershell', ['-sta', '-NoProfile', '-EncodedCommand', encoded], {
      windowsHide: false,
    });

    activeDialogProcess = ps;

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      cancelActiveDialog();
      resolve({ canceled: true, error: 'Folder picker timed out.' });
    }, 180000);

    ps.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      clearTimeout(timer);
      activeDialogProcess = null;

      if (code !== 0 && code !== null) {
        return resolve({ canceled: true, error: stderr.trim() || 'Folder picker closed.' });
      }

      const result = stdout.trim();
      if (!result || result === '__CANCELED__') {
        return resolve({ canceled: true });
      }

      resolve({ canceled: false, path: result });
    });

    ps.on('error', (err) => {
      clearTimeout(timer);
      activeDialogProcess = null;
      resolve({ canceled: true, error: err.message });
    });
  });
}
