param (
    [string]$InitialDir = ""
)

Add-Type -AssemblyName System.Windows.Forms

$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select Destination Folder for Compressed Video"
$dialog.ShowNewFolderButton = $true

if ($InitialDir -and (Test-Path $InitialDir)) {
    $dialog.SelectedPath = $InitialDir
}

$result = $dialog.ShowDialog($form)
$form.Dispose()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
} else {
    Write-Output "__CANCELED__"
}
