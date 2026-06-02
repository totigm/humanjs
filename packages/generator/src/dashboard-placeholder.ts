/**
 * Fallback dashboard served when the built Vite + React editor isn't present in
 * `dist/dashboard/`. It's a read-only view of the live timeline + code preview
 * over the same `state` protocol, with Export buttons — enough to exercise the
 * pipeline without the full editor.
 *
 * Single self-contained string — no external assets, no nested backticks.
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
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #050505; color: #e7e7e7;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      main { width: min(620px, 92vw); padding: 2rem; }
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
      .bar { display: flex; align-items: center; gap: 0.6rem; margin-top: 1.5rem; flex-wrap: wrap; }
      button {
        font: inherit; font-size: 0.8rem; color: #050505; background: #10b981;
        border: 0; border-radius: 6px; padding: 0.45rem 0.8rem; cursor: pointer;
      }
      button:hover { background: #34d399; }
      .saved { color: #10b981; font-size: 0.8rem; }
      pre.code {
        margin-top: 1rem; padding: 1rem; background: #0a0a0a; border: 1px solid #1a1a1a;
        border-radius: 8px; overflow: auto; max-height: 320px; font-size: 0.8rem;
        color: #cfcfcf; white-space: pre; line-height: 1.5;
      }
      footer { margin-top: 1.75rem; font-size: 0.8rem; }
    </style>
  </head>
  <body>
    <main>
      <h1><span class="accent">HumanJS</span> Generator</h1>
      <p class="muted">Local dashboard &mdash; read-only fallback view.</p>
      <div class="row"><span id="dot" class="dot"></span><span id="status">connecting&hellip;</span></div>
      <p class="muted target" id="target"></p>
      <ol id="events"><li class="empty">No steps captured yet &mdash; interact with the Chromium window.</li></ol>
      <div class="bar">
        <button id="exp-spec" type="button">Export .spec.ts</button>
        <button id="exp-script" type="button">Export .ts</button>
        <span id="saved" class="saved"></span>
      </div>
      <pre class="code" id="code"></pre>
      <footer class="muted">The full editor (drag, relabel, selector picker, assertions) loads here once built.</footer>
    </main>
    <script>
      var dot = document.getElementById('dot');
      var status = document.getElementById('status');
      var target = document.getElementById('target');
      var events = document.getElementById('events');
      var code = document.getElementById('code');
      var saved = document.getElementById('saved');

      function detailFor(ev) {
        var p = ev.params || {};
        if (typeof ev.inputValue === 'string') return (p.target || '') + ' = ' + JSON.stringify(ev.inputValue);
        if (p.from) return p.from + ' -> ' + p.to;
        if (p.key) return String(p.key);
        if (p.url) return String(p.url);
        if (p.kind) return p.kind + (p.target ? ' ' + p.target : '') + (p.value ? ' ' + JSON.stringify(p.value) : '');
        if (typeof p.values !== 'undefined') return (p.target || '') + ' -> ' + JSON.stringify(p.values);
        return String(p.target || '');
      }

      function renderSteps(steps) {
        events.innerHTML = '';
        if (!steps.length) {
          events.innerHTML = '<li class="empty">No steps captured yet &mdash; interact with the Chromium window.</li>';
          return;
        }
        for (var i = 0; i < steps.length; i++) {
          var ev = steps[i];
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
      }

      var ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      ws.onopen = function () { dot.classList.add('on'); status.textContent = 'connected'; };
      ws.onclose = function () { dot.classList.remove('on'); status.textContent = 'disconnected'; };
      ws.onmessage = function (event) {
        try {
          var msg = JSON.parse(event.data);
          if (msg.type === 'state') {
            target.textContent = 'Recording: ' + msg.targetUrl;
            renderSteps(msg.steps || []);
            code.textContent = msg.code || '';
          } else if (msg.type === 'exported') {
            saved.textContent = 'Saved ' + msg.path;
          }
        } catch (_) { /* ignore non-JSON frames */ }
      };

      function requestExport(format) {
        saved.textContent = '';
        ws.send(JSON.stringify({ type: 'export', format: format }));
      }
      document.getElementById('exp-spec').onclick = function () { requestExport('spec'); };
      document.getElementById('exp-script').onclick = function () { requestExport('script'); };
    </script>
  </body>
</html>
`;
