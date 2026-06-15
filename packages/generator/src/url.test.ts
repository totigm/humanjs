import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('leaves an explicit scheme untouched', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeUrl('http://example.com/path?q=1')).toBe('http://example.com/path?q=1');
  });

  it('defaults a bare host to https', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('app.example.com/login')).toBe('https://app.example.com/login');
  });

  it('uses http for loopback hosts', () => {
    expect(normalizeUrl('localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeUrl('127.0.0.1:8080/dashboard')).toBe('http://127.0.0.1:8080/dashboard');
  });

  it('does not mistake a host that merely starts with "localhost"', () => {
    expect(normalizeUrl('localhost-staging.example.com')).toBe(
      'https://localhost-staging.example.com',
    );
  });
});
