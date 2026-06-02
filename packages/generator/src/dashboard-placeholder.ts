/**
 * Embedded dashboard served until the Vite + React SPA is built into
 * `dist/dashboard/` (milestone 5). It exists so the HTTP + WebSocket transport
 * is exercisable end-to-end now: it opens the channel and reflects connection
 * state and the `hello` handshake.
 *
 * Kept as a single self-contained string — no external assets, no nested
 * backticks (they'd close this template literal).
 */
export const PLACEHOLDER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HumanJS Generator</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #050505;
        color: #e7e7e7;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      main { width: min(560px, 90vw); padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.25rem; letter-spacing: 0.02em; }
      .accent { color: #10b981; }
      .muted { color: #8a8a8a; }
      .row { display: flex; align-items: center; gap: 0.6rem; margin: 1.25rem 0 0.5rem; }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: #555; transition: background 0.2s; }
      .dot.on { background: #10b981; box-shadow: 0 0 10px #10b981; }
      .target { margin-top: 0.5rem; word-break: break-all; }
      footer { margin-top: 1.75rem; font-size: 0.8rem; }
    </style>
  </head>
  <body>
    <main>
      <h1><span class="accent">HumanJS</span> Generator</h1>
      <p class="muted">Local dashboard &mdash; placeholder for the v0.1 timeline editor.</p>
      <div class="row"><span id="dot" class="dot"></span><span id="status">connecting&hellip;</span></div>
      <p class="muted target" id="target"></p>
      <footer class="muted">Interact with the Chromium window to record. This view becomes the live, editable timeline.</footer>
    </main>
    <script>
      var dot = document.getElementById('dot');
      var status = document.getElementById('status');
      var target = document.getElementById('target');
      var ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      ws.onopen = function () { dot.classList.add('on'); status.textContent = 'connected'; };
      ws.onclose = function () { dot.classList.remove('on'); status.textContent = 'disconnected'; };
      ws.onmessage = function (event) {
        try {
          var msg = JSON.parse(event.data);
          if (msg.type === 'hello') { target.textContent = 'Recording: ' + msg.targetUrl; }
        } catch (_) { /* ignore non-JSON frames */ }
      };
    </script>
  </body>
</html>
`;
