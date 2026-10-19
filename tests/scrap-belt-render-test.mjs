import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const app = await fs.readFile(new URL('js/app.js', root), 'utf8');
const manual = JSON.parse(await fs.readFile(new URL('data/manual.json', root), 'utf8'));
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.handlers = {}; this.classList = { add() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, callback) { this.handlers[name] = callback; }
}
let opened;
const context = vm.createContext({document: {createElement: tag => new Node(tag), createTextNode: value => ({value})}, riskLabels: {high: '高风险'}, openImage: image => { opened = image; }});
vm.runInContext(app.slice(app.indexOf('  function text('), app.indexOf('  function setText(')) + app.slice(app.indexOf('  function appendList('), app.indexOf('  function emptyState(')), context);
const item = manual.faults.find(item => item.id === 'scissor-scrap-belt-discharge');
const rendered = context.buildEntry(item);
assert.equal(rendered.tag, 'details');
assert.equal(rendered.children[0].tag, 'summary');
const cards = rendered.children[1].children.filter(node => node.tag === 'section');
assert.equal(cards.length, item.procedure.length);
let images = 0;
for (const card of cards) {
  for (const image of card.children.filter(node => node.tag === 'img')) {
    images++;
    assert.equal(image.loading, 'lazy');
    image.handlers.click(); assert.equal(opened, image);
    opened = null;
    image.handlers.keydown({key: 'Enter', preventDefault() {}}); assert.equal(opened, image);
  }
}
assert.equal(images, 4);
const css = await fs.readFile(new URL('css/style.css', root), 'utf8');
assert.match(css, /\.chiller-block img\s*\{[^}]*width:100%;[^}]*height:auto/);
assert.match(css, /\.chiller-flow li \+ li::before\s*\{[^}]*display:block/);
const base = 'http://127.0.0.1:4194/welding-guide-108/';
for (const image of new Set(item.procedure.map(block => block.image).filter(Boolean))) {
  const response = await fetch(new URL(image, base));
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await fs.readFile(new URL(image, root)));
}
console.log('PASS: existing component renders all cards, four image placements open viewer, responsive CSS retained, three local HTTP images match original assets. DOM simulation only; not a real mobile/iPad browser test.');
