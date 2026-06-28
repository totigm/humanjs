import { spawn } from 'node:child_process';

/**
 * Best-effort: open `url` in the user's default browser for the dashboard.
 *
 * Uses the platform's native opener (`open` / `start` / `xdg-open`). Failures
 * are swallowed — the CLI always prints the URL too, so the user can open it
 * by hand if no opener is available (headless box, locked-down environment).
 */
export function openInBrowser(url: string): void {
  let command: string;
  let args: string[];
  if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  try {
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', () => {
      // No opener on this platform / not on PATH — the printed URL is the fallback.
    });
    child.unref();
  } catch {
    // spawn threw synchronously (rare) — ignore; the URL is printed regardless.
  }
}
