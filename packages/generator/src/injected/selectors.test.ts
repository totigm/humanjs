// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { inferSelectors } from './selectors';

function render(html: string): void {
  document.body.innerHTML = html;
}

function el(selector: string): Element {
  const found = document.querySelector(selector);
  if (!found) throw new Error(`fixture missing: ${selector}`);
  return found;
}

describe('inferSelectors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers role + accessible name for a button, then its text', () => {
    render('<button id="b">Sign in</button>');
    const out = inferSelectors(el('#b'));
    expect(out[0]).toBe('role=button[name="Sign in"]');
    expect(out).toContain('text="Sign in"');
  });

  it('derives the accessible name of an input from its associated label', () => {
    render('<label for="email">Email</label><input id="email" type="email" />');
    const out = inferSelectors(el('#email'));
    expect(out[0]).toBe('role=textbox[name="Email"]');
  });

  it('uses aria-label when present', () => {
    render('<button aria-label="Close dialog" class="x">×</button>');
    const out = inferSelectors(el('.x'));
    expect(out[0]).toBe('role=button[name="Close dialog"]');
    expect(out).toContain('[aria-label="Close dialog"]');
  });

  it('offers a test-id candidate', () => {
    render('<div data-testid="cart-total" role="status">$42</div>');
    const out = inferSelectors(el('[data-testid="cart-total"]'));
    expect(out).toContain('[data-testid="cart-total"]');
  });

  it('emits a unique #id and always falls back to an xpath', () => {
    render('<section><span id="unique">hi</span></section>');
    const out = inferSelectors(el('#unique'));
    expect(out).toContain('#unique');
    expect(out.some((s) => s.startsWith('xpath=//'))).toBe(true);
  });

  it('builds a CSS path when there is no stable handle', () => {
    render('<ul><li>one</li><li class="t">two</li></ul>');
    const out = inferSelectors(el('.t'));
    // No role/name/testid/id — first candidate is a structural CSS path.
    expect(out[0]).toMatch(/li:nth-of-type\(2\)/);
  });

  it('treats an <a> without href as not having the link role', () => {
    render('<a class="noref">menu</a>');
    const out = inferSelectors(el('.noref'));
    expect(out.some((s) => s.startsWith('role=link'))).toBe(false);
  });

  it('escapes quotes in the accessible name', () => {
    render('<button class="q">Say "hi"</button>');
    const out = inferSelectors(el('.q'));
    expect(out[0]).toBe('role=button[name="Say \\"hi\\""]');
  });
});
