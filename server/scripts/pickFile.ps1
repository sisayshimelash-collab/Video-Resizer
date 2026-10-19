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
