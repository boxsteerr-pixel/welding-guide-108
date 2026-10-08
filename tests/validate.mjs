import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const files = ["index.html", "css/style.css", "js/app.js", "data/manual.json", "manifest.json", "service-worker.js", "assets/icons/icon.svg", "assets/icons/icon-192.png", "assets/icons/icon-512.png"];
await Promise.all(files.map((file) => stat(path.join(root, file))));
const [html, app, dataText, manifestText, sw] = await Promise.all([read("index.html"), read("js/app.js"), read("data/manual.json"), read("manifest.json"), read("service-worker.js")]);
const manual = JSON.parse(dataText);
const manifest = JSON.parse(manifestText);

assert.equal(manual.machine.machineId, "108");
assert.equal(manual.machine.machineName, "108激光焊机");
assert.equal(manual.machine.manualVersion, "0.2.0");
assert.equal(manual.faults.length, 1);
const procedure = manual.faults[0].procedure;
assert.deepEqual(procedure.filter(block => block.number).map(block => block.number), ["01", "02", "03", "04", "05"]);
assert.equal(procedure[1].tone, "warning");
assert.equal(procedure.at(-1).title, "快速记忆");
assert.equal(procedure.at(-2).tone, "success");
const images = [...new Set(procedure.map(block => block.image).filter(Boolean))];
assert.equal(images.length, 4);
for (const image of images) {
  await stat(path.join(root, image));
  assert.ok(sw.includes(`"${image}"`), `离线缓存缺少图片：${image}`);
}
assert.deepEqual(manual.maintenance, []);
assert.deepEqual(manual.safety, []);
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.match(sw, /const CACHE_NAME = "welding-guide-108-v10"/);
assert.match(sw, /const CACHE_PREFIX = "welding-guide-108-"/);
assert.match(sw, /\.\/data\/manual\.json/);
assert.match(app, /fetch\("\.\/data\/manual\.json"/);
assert.match(html, /data-section="faults"/);
assert.match(html, /id="image-modal"/);

const combined = `${html}\n${app}\n${dataText}\n${manifestText}\n${sw}`;
assert.doesNotMatch(combined, /boxsteerr-pixel\.github\.io\/welding-guide\//, "不得引用101线上资源");
assert.doesNotMatch(combined, /(?:src|href)=["']\/welding-guide\//, "不得硬编码101路径");
console.log("welding-guide-108 validation: PASS");
