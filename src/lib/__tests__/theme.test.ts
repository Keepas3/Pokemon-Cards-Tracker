import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards the site's theme: every color must come from the tokens in globals.css
// (so light/dark work everywhere), and those tokens must stay readable.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const CSS = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

// --- parsing the token blocks out of globals.css ---

function blockAfter(marker: string): string {
  const start = CSS.indexOf(marker);
  if (start < 0) throw new Error(`globals.css has no ${marker}`);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    if (CSS[i] === "}" && --depth === 0) return CSS.slice(open + 1, i);
  }
  throw new Error(`unterminated block after ${marker}`);
}

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const light = tokens(blockAfter(":root {"));
const darkSystem = tokens(blockAfter(':root:not([data-theme="light"])'));
const darkChosen = tokens(blockAfter(':root[data-theme="dark"]'));

// --- WCAG contrast ---

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme tokens", () => {
  it("define the same set of tokens in light and dark", () => {
    expect(Object.keys(darkChosen).sort()).toEqual(Object.keys(light).sort());
  });

  it("keep the two dark-theme copies identical (system preference vs. explicit choice)", () => {
    expect(darkSystem).toEqual(darkChosen);
  });

  for (const [name, t] of [["light", light], ["dark", darkChosen]] as const) {
    describe(`${name} theme contrast`, () => {
      it("reads primary and secondary text clearly on every surface (4.5:1)", () => {
        for (const text of ["fg", "muted"]) {
          for (const bg of ["bg", "surface", "surface-2"]) {
            expect(contrast(t[text], t[bg]), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it("keeps tertiary text legible (3:1) — it's for hints, never essential content", () => {
        for (const bg of ["bg", "surface", "surface-2"]) {
          expect(contrast(t.subtle, t[bg]), `subtle on ${bg}`).toBeGreaterThanOrEqual(3);
        }
      });

      it("reads the accent: button text, links and active nav (4.5:1)", () => {
        expect(contrast(t["accent-fg"], t.accent), "accent-fg on accent").toBeGreaterThanOrEqual(4.5);
        expect(contrast(t["accent-text"], t["accent-soft"]), "accent-text on accent-soft").toBeGreaterThanOrEqual(4.5);
        expect(contrast(t["accent-text"], t.surface), "accent-text on surface").toBeGreaterThanOrEqual(4.5);
        expect(contrast(t["accent-text"], t.bg), "accent-text on bg").toBeGreaterThanOrEqual(4.5);
      });

      it("reads status colors on the page and on their own tinted backgrounds (4.5:1)", () => {
        for (const s of ["good", "warn", "bad"]) {
          expect(contrast(t[s], t.bg), `${s} on bg`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t[s], t.surface), `${s} on surface`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t[s], t[`${s}-soft`]), `${s} on ${s}-soft`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("reads the green button's label (the page color on the status green)", () => {
        expect(contrast(t.bg, t.good), "bg on good").toBeGreaterThanOrEqual(4.5);
      });

      it("keeps borders visible against the page without shouting", () => {
        expect(contrast(t["line-strong"], t.surface), "line-strong on surface").toBeGreaterThanOrEqual(1.3);
      });
    });
  }
});

// --- no raw colors in the UI ---

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(p);
    else if (p.endsWith(".tsx")) yield p;
  }
}

// Tailwind's built-in palette and absolute black/white bypass the theme.
const RAW_COLOR =
  /(?<![\w-])(?:bg|text|border|ring|divide|from|via|to|fill|stroke|outline|decoration|shadow)-(?:(?:neutral|gray|grey|slate|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?![\w-])/g;

describe("UI colors", () => {
  it("come only from the theme tokens (no raw Tailwind palette, white or black)", () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(path.join(ROOT, "src/components")), ...sourceFiles(path.join(ROOT, "src/app"))]) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(RAW_COLOR)) {
        const line = text.slice(0, m.index).split("\n").length;
        offenders.push(`${path.relative(ROOT, file)}:${line} ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("don't use emoji as interface icons (Discord messages are the exception)", () => {
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const offenders: string[] = [];
    for (const file of [...sourceFiles(path.join(ROOT, "src/components")), ...sourceFiles(path.join(ROOT, "src/app"))]) {
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.trim();
          if (EMOJI.test(line) && !code.startsWith("//") && !code.startsWith("*")) {
            offenders.push(`${path.relative(ROOT, file)}:${i + 1} ${code.slice(0, 80)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
