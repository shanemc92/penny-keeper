#!/usr/bin/env node
/* Checks on the built page itself (index.html), the part the maths tests do not load.

     node tests/page.js

   - the one big script compiles (a typo in any src/ui file is a syntax error here, not a blank page for a user)
   - no function is defined twice (the scripts share one scope, so the second silently replaces the first)
   - no build placeholder was left unfilled
   - every page in the menu has a renderer, and every renderer has a menu entry
   - the page is self-contained: no external scripts, styles or frames, and the content security policy is present
   - the embedded example household is intact */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const problems = [];
const check = (ok, message) => { if (!ok) problems.push(message); };

const m = html.match(/<script>\n([\s\S]*)<\/script><\/body><\/html>\n$/);
check(!!m, 'index.html does not end with its single <script> block');
const code = m ? m[1] : '';
check((html.match(/<\/script>/g) || []).length === 1, 'expected exactly one closing </script> tag (an embedded file must not close the whole page script)');

try { new vm.Script(code, {filename: 'index.html'}); }
catch (e) { check(false, 'the script does not compile: ' + e.message); }

check(!/\/\*@[A-Z_]+\*\//.test(code), 'a build placeholder (/*@NAME*/) was left in the page');

const seen = {};
for (const x of code.matchAll(/^function ([A-Za-z0-9_$]+)\(/gm)) seen[x[1]] = (seen[x[1]] || 0) + 1;
const dupes = Object.keys(seen).filter(k => seen[k] > 1);
check(!dupes.length, 'functions defined more than once: ' + dupes.join(', '));

const navIds = [...(code.match(/const NAV = \[([\s\S]*?)\n\];/) || ['', ''])[1].matchAll(/\['([a-z]+)','/g)].map(x => x[1]);
const rendererIds = [...(code.match(/Object\.assign\(RENDERERS, \{([\s\S]*?)\}\);/) || ['', ''])[1].matchAll(/([a-z]+):render[A-Za-z]+/g)].map(x => x[1]);
check(navIds.length > 10, 'could not read the menu (found ' + navIds.length + ' pages)');
check(navIds.filter(id => !rendererIds.includes(id)).length === 0, 'menu pages with no renderer: ' + navIds.filter(id => !rendererIds.includes(id)).join(', '));
check(rendererIds.filter(id => !navIds.includes(id)).length === 0, 'renderers with no menu entry: ' + rendererIds.filter(id => !navIds.includes(id)).join(', '));

check(/<meta http-equiv="Content-Security-Policy"/.test(html), 'no content security policy');
const head = html.slice(0, html.indexOf('<script>'));
check(!/<(script|link|iframe|img)[^>]+(src|href)="(https?:)?\/\//i.test(head), 'the page loads something from another origin');

const demo = code.match(/const DEMO_YEAR_JSON = ("(?:[^"\\]|\\.)*");/);
check(!!demo, 'the example household is missing');
if (demo) {
  try { const d = JSON.parse(vm.runInNewContext(demo[1])); check(d.people && d.people.length > 0 && d.bills && d.bills.length > 0, 'the example household has no people or bills'); }
  catch (e) { check(false, 'the example household does not parse: ' + e.message); }
}

if (problems.length) {
  console.log(problems.map(p => '  FAIL  ' + p).join('\n') + '\n\n' + problems.length + ' problem(s)');
  process.exit(1);
}
console.log('  ok    the page compiles, has ' + Object.keys(seen).length + ' functions with no duplicates, ' + navIds.length + ' menu pages that all have renderers, and is self-contained');
