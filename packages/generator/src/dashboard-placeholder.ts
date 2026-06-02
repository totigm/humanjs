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
      ol { margin: 1rem 0 0; padding-left: 0; list-style: none; font-size: 0.85rem; }
      ol li { padding: 0.35rem 0; border-top: 1px solid #1a1a1a; display: flex; gap: 0.6rem; }
      ol li .kind { color: #10b981; min-width: 5.5rem; }
      ol li .detail { color: #c9c9c9; word-break: break-all; }
      .empty { color: #6a6a6a; }
      footer { margin-top: 1.75rem; font-size: 0.8rem; }
    </style>
  </head>
  <body>
    <main>
      <h1><span class="accent">HumanJS</span> Generator</h1>
      <p class="muted">Local dashboard &mdash; placeholder for the v0.1 timeline editor.</p>
      <div class="row"><span id="dot" class="dot"></span><span id="status">connecting&hellip;</span></div>
      <p class="muted target" id="target"></p>
      <ol id="events"><li class="empty">No steps captured yet &mdash; interact with the Chromium window.</li></ol>
      <footer class="muted">This view becomes the live, editable timeline.</footer>
    </main>
    <script>
      var dot = document.getElementById('dot');
      var status = document.getElementById('status');
      var target = document.getElementById('target');
      var events = document.getElementById('events');
      var count = 0;

      function detailFor(ev) {
        var p = ev.params || {};
        if (typeof ev.inputValue === 'string') return (p.target || '') + ' = ' + JSON.stringify(ev.inputValue);
        if (p.from) return p.from + ' -> ' + p.to;
        if (p.key) return String(p.key);
        if (p.url) return String(p.url);
        if (typeof p.values !== 'undefined') return (p.target || '') + ' -> ' + JSON.stringify(p.values);
        return String(p.target || '');
      }

      function addEvent(ev) {
        if (count === 0) events.innerHTML = '';
        count += 1;
        var li = document.createElement('li');
        var kind = document.createElement('span');
        kind.className = 'kind';
        kind.textContent = ev.type;
        var detail = document.createElement('span');
        detail.className = 'detail';
        detail.textContent = detailFor(ev);
        li.appendChild(kind);
        li.appendChild(detail);
        events.appendChild(li);
      }

      var ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      ws.onopen = function () { dot.classList.add('on'); status.textContent = 'connected'; };
      ws.onclose = function () { dot.classList.remove('on'); status.textContent = 'disconnected'; };
      ws.onmessage = function (event) {
        try {
          var msg = JSON.parse(event.data);
          if (msg.type === 'hello') { target.textContent = 'Recording: ' + msg.targetUrl; }
          else if (msg.type === 'event') { addEvent(msg.event); }
        } catch (_) { /* ignore non-JSON frames */ }
      };
    </script>
  </body>
</html>
`;
