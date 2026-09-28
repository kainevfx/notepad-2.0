// Command-line parsing for Notepad 2.0.
//
// Normal launches:           notepad2.exe [--hidden] [--quicknote] [file ...]
// Launched via "Replace Notepad" (Image File Execution Options), Windows prepends our
// Debugger value to the original command line:
//   notepad2.exe --notepad-style-cmdline C:\Windows\System32\notepad.exe [/A|/W|/P|/PT printer driver port] [file]
// Notepad treats everything after the switches as ONE path, even unquoted with spaces.

export interface LaunchRequest {
  files: string[];
  print: boolean;
  hidden: boolean;
  quickNote: boolean;
  viaNotepad: boolean;
}

const NOTEPAD_RE = /(^|[\\/])notepad(\.exe)?$/i;

export function isAbsoluteWinPath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\') || p.startsWith('/');
}

export function resolvePath(p: string, cwd: string | null): string {
  if (!cwd || isAbsoluteWinPath(p)) return p;
  const sep = cwd.includes('\\') ? '\\' : '/';
  return cwd.replace(/[\\/]+$/, '') + sep + p;
}

function unquote(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

/** argv includes the executable at index 0, as std::env::args() gives it. */
export function parseLaunchArgs(argv: string[], cwd: string | null = null): LaunchRequest {
  const req: LaunchRequest = { files: [], print: false, hidden: false, quickNote: false, viaNotepad: false };
  const args = argv.slice(1).map(unquote);
  const ns = args.indexOf('--notepad-style-cmdline');
  if (ns >= 0) {
    req.viaNotepad = true;
    let rest = args.slice(ns + 1);
    if (rest.length && NOTEPAD_RE.test(rest[0])) rest = rest.slice(1);
    // Notepad switches come first.
    while (rest.length && /^\/[a-z]+$/i.test(rest[0])) {
      const sw = rest[0].toUpperCase();
      rest = rest.slice(1);
      if (sw === '/P') req.print = true;
      else if (sw === '/PT') {
        req.print = true;
        // /PT <file> <printer> <driver> <port>: the file comes first, drop the printer triple.
        if (rest.length >= 4) rest = rest.slice(0, rest.length - 3);
      }
    }
    const joined = rest.join(' ').trim();
    if (joined) req.files.push(resolvePath(unquote(joined), cwd));
    return req;
  }
  for (const a of args) {
    if (a === '--hidden' || a === '--minimized' || a === '--tray') req.hidden = true;
    else if (a === '--quicknote') req.quickNote = true;
    else if (a.startsWith('--')) continue; // unknown flags are ignored, never opened as files
    else if (/^\/[a-z]+$/i.test(a)) {
      if (a.toUpperCase() === '/P') req.print = true;
    } else if (a.trim()) req.files.push(resolvePath(a, cwd));
  }
  return req;
}
