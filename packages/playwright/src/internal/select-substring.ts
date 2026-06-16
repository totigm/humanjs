/// <reference lib="dom" />

/**
 * Selects the first occurrence of `needleRaw` inside `el`'s text and returns
 * whether it was found. Runs in the browser via `locator.evaluate`, so it has
 * to be self-contained (no imports / closures).
 *
 * Matching is whitespace-normalized — the recorded text collapses runs of
 * whitespace, and real markup is full of incidental spacing — but the match is
 * mapped back to exact text-node offsets, so a `Range` that spans inline
 * children (e.g. selecting across a `<b>` inside a `<p>`) still selects
 * correctly. Returns `false` when the text isn't present, letting the caller
 * fall back to selecting the element's whole text.
 */
export function selectSubstringInElement(el: Element, needleRaw: string): boolean {
  const needle = needleRaw.replace(/\s+/g, ' ').trim();
  if (!needle) return false;

  // Walk the element's text nodes, building a whitespace-collapsed string while
  // recording, for every kept character, the source node + offset it came from.
  const map: Array<[Text, number]> = [];
  let normalized = '';
  let prevSpace = true; // start "in space" so leading whitespace collapses away
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const data = text.data;
    for (let i = 0; i < data.length; i++) {
      const ch = data.charAt(i);
      if (/\s/.test(ch)) {
        if (!prevSpace) {
          normalized += ' ';
          map.push([text, i]);
        }
        prevSpace = true;
      } else {
        normalized += ch;
        map.push([text, i]);
        prevSpace = false;
      }
    }
  }
  // Drop a trailing collapsed space so offsets line up with `normalized`.
  if (normalized.endsWith(' ')) {
    normalized = normalized.slice(0, -1);
    map.pop();
  }

  const start = normalized.indexOf(needle);
  if (start === -1) return false;
  const startPos = map[start];
  const endPos = map[start + needle.length - 1];
  if (!startPos || !endPos) return false;

  const range = document.createRange();
  range.setStart(startPos[0], startPos[1]);
  range.setEnd(endPos[0], endPos[1] + 1); // end offset is exclusive
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}
