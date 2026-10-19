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
assert.equal(manual.machine.manualVersion, "0.3.0");
assert.equal(manual.faults.length, 7);
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
assert.equal(manual.maintenance.length, 1);
const focus = manual.maintenance[0];
assert.equal(focus.id, "segment-focus-position-check");
assert.equal(focus.title, "段焊确认焦点位置");
assert.deepEqual(focus.procedure.filter(block => block.number).map(block => block.number), ["01", "02", "03", "04"]);
const numberedFocus = focus.procedure.filter(block => block.number);
assert.match(JSON.stringify(numberedFocus[0]), /由“关”切换至“开”/);
assert.match(JSON.stringify(numberedFocus[2]), /由“开”切换回“关”/);
assert.match(JSON.stringify(numberedFocus[2]), /再选择“重焊”/);
assert.deepEqual(numberedFocus[3].flow, ["WS｜操作侧", "CS｜中间", "DS｜传动侧"]);
const focusImages = focus.procedure.filter(block => block.image);
assert.equal(focusImages.length, 2);
assert.ok(!numberedFocus[2].image && !numberedFocus[3].image);
for (const block of focusImages) {
  await stat(path.join(root, block.image));
  assert.ok(sw.includes(`"${block.image}"`));
}
for (const marker of ["图2待补", "图3待补", "图4待补", "图5待补", "图6待补"]) assert.ok(JSON.stringify(focus).includes(marker));
assert.deepEqual(manual.safety, []);
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
const table = manual.faults[1];
assert.equal(table.id, "table-sides-not-synchronized");
assert.deepEqual(table.procedure.filter(block => block.number).map(block => block.number), ["01", "02", "03", "04", "05"]);
assert.deepEqual(table.procedure[3].flow.map(line => line.split("｜")[0]), ["C", "D（操作侧） / E（传动侧）", "F（操作侧锁轴） / G（传动侧锁轴）", "A（操作侧实际值） / B（传动侧实际值）"]);
assert.match(JSON.stringify(table), /≤ 8 mm/);
assert.doesNotMatch(JSON.stringify(table), /到焊接位/);
for (const block of table.procedure.filter(block => block.image)) {
  await stat(path.join(root, block.image));
  assert.ok(sw.includes(`"${block.image}"`));
}
const plc = manual.faults[2];
assert.equal(plc.id, "hmi-plc-connection-failure");
assert.deepEqual(plc.procedure.filter(block => block.number).map(block => block.number), ["01", "02", "03", "04", "05", "06"]);
assert.match(JSON.stringify(plc), /正常网口状态：绿灯亮，黄灯闪烁/);
assert.match(JSON.stringify(plc), /网口已正常但报警仍存在时进入步骤4/);
assert.equal(plc.procedure.find(block => block.number === "04").image, "./assets/images/hmi-exit-button-annotated.png");
assert.doesNotMatch(JSON.stringify(plc), /segment-focus-machine-adjustment-entry|不是“退出”键|“按下退出键”标注图、/);
assert.ok(plc.procedure.some(block => block.title.startsWith("备注") && block.paragraphs.some(line => typeof line === "string" && /系统管理员登录密码：\d{4}/.test(line))));
for (const block of plc.procedure.filter(block => block.image)) {
  await stat(path.join(root, block.image));
  assert.ok(sw.includes(`"${block.image}"`));
}
assert.match(sw, /const CACHE_NAME = "welding-guide-108-v16"/);
assert.doesNotMatch(dataText, /needs_review|待审核|待现场审核|本地草稿|未审核|安全审核|本地新增，待人工核对/);
const approvedIds = ["centering-block-2-3-home-jam", "secondary-cut-manual-operation", "restore-welder-auto", "nozzle-unblocking-penetration-curve"];
for (const id of approvedIds) assert.equal(manual.faults.find(item => item.id === id).status, "approved");
for (const item of [...manual.faults, ...manual.maintenance]) {
  for (const block of item.procedure || []) {
    if (block.image) { await stat(path.join(root, block.image)); assert.ok(sw.includes(`"${block.image}"`)); }
  }
}
assert.match(JSON.stringify(manual.faults.find(item => item.id === "centering-block-2-3-home-jam")), /强制信号不等于实际设备状态恢复/);
assert.match(JSON.stringify(manual.faults.find(item => item.id === "secondary-cut-manual-operation")), /2秒及以上/);
assert.match(JSON.stringify(manual.faults.find(item => item.id === "restore-welder-auto")), /不得仅凭钥匙开关位置/);
assert.match(JSON.stringify(manual.faults.find(item => item.id === "nozzle-unblocking-penetration-curve")), /身体不得探入旁边剪刀区域/);
assert.match(html, /id="currentTime"/);
assert.match(html, /system-time\.js\?v=1/);
assert.match(sw, /system-time\.js\?v=1/);
assert.match(sw, /const CACHE_PREFIX = "welding-guide-108-"/);
assert.match(sw, /\.\/data\/manual\.json/);
assert.match(app, /fetch\("\.\/data\/manual\.json"/);
assert.match(html, /data-section="faults"/);
assert.match(html, /id="image-modal"/);

const combined = `${html}\n${app}\n${dataText}\n${manifestText}\n${sw}`;
assert.doesNotMatch(combined, /boxsteerr-pixel\.github\.io\/welding-guide\//, "不得引用101线上资源");
assert.doesNotMatch(combined, /(?:src|href)=["']\/welding-guide\//, "不得硬编码101路径");
console.log("welding-guide-108 validation: PASS");
