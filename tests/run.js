#!/usr/bin/env node
/* Runs tests/maths.test.js against the calculation engine (src/engine) with no browser.

     node tests/run.js

   The engine files are joined in file-name order, exactly as build.py joins them into the page, and run in a
   Node `vm` context with just enough stand-ins for the browser (localStorage, window, document). The engine
   must not touch the page when it loads, so if one of these stand-ins is ever needed at load time this fails
   loudly instead of passing by accident. Exits 1 if any test fails. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8').replace(/\r\n/g, '\n');
const engine = fs.readdirSync(path.join(root, 'src', 'engine')).filter(f => f.endsWith('.js')).sort();

const store = {};
const refuse = what => () => { throw new Error('the engine touched ' + what + ' while loading'); };
const sandbox = {
  console,
  setTimeout, clearTimeout,
  localStorage: {getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }},
  window: {matchMedia: () => ({matches: false})},
  document: {querySelector: refuse('document.querySelector'), querySelectorAll: refuse('document.querySelectorAll'), documentElement: {}},
  navigator: {},
  __results: null,
};
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);

const code = engine.map(f => read('src', 'engine', f)).join('') + '\n' + read('tests', 'maths.test.js') + '\n__results = runMathsTests();';
vm.runInContext(code, sandbox, {filename: 'engine+tests'});

const results = sandbox.__results;
let failed = 0;
for (const r of results) {
  if (r.ok) console.log('  ok    ' + r.name);
  else { failed++; console.log('  FAIL  ' + r.name + '\n          ' + r.error); }
}
console.log('\n' + (results.length - failed) + ' of ' + results.length + ' tests passed');
process.exit(failed ? 1 : 0);
