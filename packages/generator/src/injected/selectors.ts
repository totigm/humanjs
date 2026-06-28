/**
 * Ranked selector inference — runs in the page (needs the live DOM).
 *
 * Returns Playwright locator strings best-first, following the HumanJS
 * preference order: ARIA role + accessible name → aria-label → visible text →
 * test id → unique `#id` → CSS path → XPath. The first is what gets used; the
 * dashboard's selector picker (milestone 5) lets the user choose another.
 *
 * Role/text/label candidates are emitted optimistically (their Playwright
 * engines can't be resolution-checked from the DOM); CSS/XPath candidates are
 * verified unique before being offered.
 */

/** Implicit ARIA roles for the tags we target. `a` only counts as a link with an href. */
const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button',
  select: 'combobox',
  textarea: 'textbox',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
};

const INPUT_TYPE_ROLES: Record<string, string> = {
  text: 'textbox',
  email: 'textbox',
  tel: 'textbox',
  url: 'textbox',
  search: 'searchbox',
  password: 'textbox',
  number: 'spinbutton',
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  submit: 'button',
  button: 'button',
  reset: 'button',
  image: 'button',
};

const TEST_ID_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa'];

function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function cssEscape(value: string): string {
  // CSS.escape exists in every browser we inject into; the typeof guard keeps
  // the function usable under test runners that stub a partial global.
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function getRole(el: Element): string | null {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit.trim().split(/\s+/)[0] ?? null;

  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    return INPUT_TYPE_ROLES[type] ?? 'textbox';
  }
  return IMPLICIT_ROLES[tag] ?? null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function getAccessibleName(el: Element): string {
  const ariaLabel = normalizeText(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const named = labelledby
      .split(/\s+/)
      .map((id) => normalizeText(document.getElementById(id)?.textContent))
      .filter(Boolean)
      .join(' ');
    if (named) return named;
  }

  // Associated <label> for form controls.
  const labels = (el as HTMLInputElement).labels;
  if (labels && labels.length > 0) {
    const named = normalizeText(labels[0]?.textContent);
    if (named) return named;
  }

  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'reset') {
      return normalizeText((el as HTMLInputElement).value);
    }
  }
  if (tag === 'img') return normalizeText(el.getAttribute('alt'));
  if (tag === 'button' || tag === 'a' || tag === 'summary' || el.getAttribute('role')) {
    return normalizeText(el.textContent);
  }
  return '';
}

function getTestId(el: Element): string | null {
  for (const attr of TEST_ID_ATTRS) {
    const value = el.getAttribute(attr);
    if (value) return `[${attr}=${quote(value)}]`;
  }
  return null;
}

function uniqueCss(el: Element): string {
  if (el.id && isUnique(`#${cssEscape(el.id)}`)) return `#${cssEscape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    if (node.id) {
      parts.unshift(`#${cssEscape(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node?.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (isUnique(parts.join(' > '))) break;
    node = parent;
  }
  return parts.join(' > ');
}

function xpath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && node !== document.documentElement) {
    let index = 1;
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === node.tagName) index += 1;
      sibling = sibling.previousElementSibling;
    }
    parts.unshift(`${node.tagName.toLowerCase()}[${index}]`);
    node = node.parentElement;
  }
  return `//${parts.join('/')}`;
}

/** Build the ranked list of locator-string candidates for `el`, best first. */
export function inferSelectors(el: Element): string[] {
  const candidates: string[] = [];
  const push = (selector: string | null): void => {
    if (selector && !candidates.includes(selector)) candidates.push(selector);
  };

  const role = getRole(el);
  const name = getAccessibleName(el);
  if (role && name) push(`role=${role}[name=${quote(name)}]`);

  const ariaLabel = normalizeText(el.getAttribute('aria-label'));
  if (ariaLabel) push(`[aria-label=${quote(ariaLabel)}]`);

  // Visible text for interactive, text-bearing elements (links, buttons).
  const tag = el.tagName.toLowerCase();
  if (tag === 'a' || tag === 'button' || tag === 'summary' || el.getAttribute('role')) {
    const text = normalizeText(el.textContent);
    if (text && text.length <= 50) push(`text=${quote(text)}`);
  }

  push(getTestId(el));

  if (el.id && isUnique(`#${cssEscape(el.id)}`)) push(`#${cssEscape(el.id)}`);

  push(uniqueCss(el));
  push(`xpath=${xpath(el)}`);

  return candidates;
}
