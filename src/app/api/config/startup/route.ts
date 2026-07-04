import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { db } from '@/lib/db';

function getShortcutPath(): string | null {
  if (process.platform !== 'win32') return null;
  const appData = process.env.APPDATA;
  if (!appData) return null;
  return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'MailAgentAI.lnk');
}

// GET /api/config/startup — Check if the startup task is registered
export async function GET() {
  try {
    const shortcut = getShortcutPath();
    const isEnabled = shortcut ? fs.existsSync(shortcut) : false;
    return NextResponse.json({ enabled: isEnabled, supported: process.platform === 'win32' });
  } catch (error: any) {
    return NextResponse.json({ enabled: false, supported: process.platform === 'win32', error: error.message });
  }
}

// POST /api/config/startup — Enable or disable Windows run-on-startup
export async function POST(request: NextRequest) {
  try {
    const { enable } = await request.json();
    const shortcut = getShortcutPath();

    if (process.platform !== 'win32' || !shortcut) {
      return NextResponse.json({ error: 'Startup configuration is only supported on Windows.' }, { status: 400 });
    }

    if (enable) {
      const projectDir = process.cwd();
      const psScript = path.join(projectDir, 'scripts', 'setup-startup.ps1');

      if (!fs.existsSync(psScript)) {
        return NextResponse.json({ error: 'Startup script setup-startup.ps1 not found in scripts directory.' }, { status: 500 });
      }

      // Execute PowerShell script to create shortcut
      return new Promise<NextResponse>((resolve) => {
        exec(`powershell.exe -ExecutionPolicy Bypass -File "${psScript}"`, async (err, stdout, stderr) => {
          if (err) {
            console.error('PowerShell startup setup failed:', stderr);
            resolve(NextResponse.json({ error: stderr || 'Failed to execute startup script' }, { status: 500 }));
          } else {
            // Log success
            await db.activityLog.create({
              data: {
                action: 'STARTUP_ENABLED',
                category: 'system',
                status: 'success',
                details: JSON.stringify({ stdout: stdout.trim() }),
              },
            });
            resolve(NextResponse.json({ success: true, enabled: true }));
          }
        });
      });
    } else {
      if (fs.existsSync(shortcut)) {
        fs.unlinkSync(shortcut);
      }

      // Log success
      await db.activityLog.create({
        data: {
          action: 'STARTUP_DISABLED',
          category: 'system',
          status: 'success',
        },
      });

      return NextResponse.json({ success: true, enabled: false });
    }
  } catch (error: any) {
    console.error('Startup toggle failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to toggle startup configuration' }, { status: 500 });
  }
}
