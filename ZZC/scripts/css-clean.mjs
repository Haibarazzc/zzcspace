// css-clean.mjs — conservative dead-class removal for styles.css
// Drops a rule only when EVERY class selector in it is absent from all src files.
import fs from "node:fs";
import path from "node:path";

// ---- 1. collect alive classes from all src files ----
const srcFiles = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) srcFiles.push(p);
  }
}
walk("src");

const alive = new Set();
const addTokens = (str) => {
  for (const tok of str.split(/\s+/)) {
    if (tok.includes("$") || tok.includes("{")) continue;
    if (/^[\w-]+$/.test(tok)) alive.add(tok);
  }
};
const addQuoted = (code) => {
  const qs = code.match(/['"`][^'"`]+['"`]/g) || [];
  for (const q of qs) addTokens(q.slice(1, -1));
};

for (const f of srcFiles) {
  const s = fs.readFileSync(f, "utf8");
  let m;
  for (const re of [/className="([^"]+)"/g, /className='([^']+)'/g]) {
    while ((m = re.exec(s))) addTokens(m[1]);
  }
  // template literals: className={`a b${cond ? " c" : ""}`}
  const tplRe = /className=\{`([^`]*)`\}/g;
  while ((m = tplRe.exec(s))) {
    const raw = m[1];
    const segments = raw.match(/\$\{[^}]*\}/g) || [];
    for (const seg of segments) addQuoted(seg);
    addTokens(raw.replace(/\$\{[^}]*\}/g, " "));
  }
  // other dynamic: className={cond ? 'a' : 'b'}
  const dynRe = /className=\{([^}]+)\}/g;
  while ((m = dynRe.exec(s))) {
    const inner = m[1];
    if (inner.trim().startsWith("`")) continue; // handled above
    addQuoted(inner);
  }
  // selector strings used by gsap / querySelector
  const selRe = /(?:toArray|querySelectorAll?|getElementsBy\w+)\([^)]*['"`]([^'"`]+)['"`]/g;
  while ((m = selRe.exec(s))) {
    for (const cls of m[1].match(/\.[\w-]+/g) || []) alive.add(cls.slice(1));
  }
  const gsapRe = /trigger:\s*['"`]([^'"`]+)['"`]/g;
  while ((m = gsapRe.exec(s))) {
    for (const cls of m[1].match(/\.[\w-]+/g) || []) alive.add(cls.slice(1));
  }
}
// runtime / dynamic safety whitelist
for (const c of ["open", "p0", "p1", "p2", "p3", "p4", "p5", "custom-cursor", "is-hovering"]) {
  alive.add(c);
}
console.log("alive classes: " + alive.size);
console.log("check interactive-cube alive: " + alive.has("interactive-cube"));

// ---- 2. parse + classify ----
function splitBlocks(line) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "{") depth++;
    else if (line[i] === "}") {
      depth--;
      if (depth === 0) { parts.push(line.slice(start, i + 1)); start = i + 1; }
    }
  }
  return parts.filter((p) => p.trim());
}

function classify(part) {
  if (part.startsWith("@media")) {
    const m = part.match(/^@media([^{]*)\{(.*)\}$/);
    if (!m) return part;
    const cond = m[1], inner = m[2];
    const kept = splitBlocks(inner).map(classify).filter(Boolean).join("");
    return kept.length ? "@media" + cond + "{" + kept + "}" : "";
  }
  const m = part.match(/^([^{]*)\{(.*)\}$/);
  if (!m) return part;
  const selector = m[1];
  const classes = [...new Set((selector.match(/\.[A-Za-z_][\w-]*/g) || []).map((c) => c.slice(1)))];
  if (classes.length === 0) return part; // keyframes/structural/attribute selectors — keep
  const allDead = classes.every((c) => !alive.has(c));
  return allDead ? "" : part;
}

// ---- 3. process file ----
const cssPath = "src/styles.css";
const before = fs.readFileSync(cssPath, "utf8");
const lines = before.split("\n");
const out = [];
let droppedRules = 0, keptRules = 0;
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith("/*")) { out.push(line); continue; }
  const parts = splitBlocks(line);
  if (parts.length === 0) { out.push(line); continue; }
  const rebuilt = parts.map((p) => {
    const r = classify(p);
    if (r === p) keptRules++;
    else if (r === "") droppedRules++;
    return r;
  }).join("");
  out.push(rebuilt);
}
const after = out.join("\n");
fs.writeFileSync(cssPath, after);
console.log("kept rules: " + keptRules + ", dropped dead rules: " + droppedRules);
console.log("size: " + before.length + " -> " + after.length + " bytes (-" + Math.round((1 - after.length / before.length) * 100) + "%)");
