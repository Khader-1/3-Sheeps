// Where the site actually lives.
//
// Everything here used to be addressed from the server root — /src, /assets,
// /web. That is correct when the project is served at /, which is what the
// local preview server and the LAN address both do, and it breaks completely
// on GitHub Pages: a project repo is published under /<repo>/, so every one of
// those paths resolves to the wrong place and 404s.
//
// This module sits at <root>/src/base.js, so its own URL is the one thing in
// the codebase that always knows where the root is, whatever the site happens
// to be mounted under. Everything that fetches goes through asset().

export const BASE = new URL('../', import.meta.url).href;

/**
 * Resolve a root-relative path against the site root.
 *
 * The leading slash has to go before new URL() sees it: "/assets/x" against a
 * base of ".../3-Sheeps/" resolves to the *origin* root, silently undoing the
 * whole point. Fully-qualified URLs and blob: URLs pass straight through.
 */
export function asset(p) {
  const s = String(p);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return new URL(s.replace(/^\/+/, ''), BASE).href;
}
