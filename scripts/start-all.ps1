$WorkspaceDir = (Get-Item -Path ".\").FullName

# Run database migration to ensure the schema is in sync
Start-Process -FilePath "npx.cmd" -ArgumentList "prisma db push" -WorkingDirectory $WorkspaceDir -WindowStyle Hidden -Wait

# Start Next.js development server
Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $WorkspaceDir -WindowStyle Hidden

# Start IMAP poller background worker
Start-Process -FilePath "node.exe" -ArgumentList ".\mini-services\imap-worker\index.js" -WorkingDirectory $WorkspaceDir -WindowStyle Hidden

Write-Host "MailAgent AI background processes started successfully!"
