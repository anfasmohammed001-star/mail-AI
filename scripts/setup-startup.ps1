$WorkspaceDir = (Get-Item -Path ".\").FullName
$StartupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$ShortcutPath = [System.IO.Path]::Combine($StartupFolder, "MailAgentAI.lnk")

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -Command `"cd '$WorkspaceDir'; powershell.exe -ExecutionPolicy Bypass -File .\scripts\start-all.ps1`""
$Shortcut.WorkingDirectory = $WorkspaceDir
$Shortcut.Description = "Start MailAgent AI Background Services"
$Shortcut.Save()

Write-Host "Success: MailAgent AI startup shortcut created at $ShortcutPath"
