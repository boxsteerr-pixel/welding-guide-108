import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base='http://127.0.0.1:4194/welding-guide-108/';
const listeners={},stores=new Map();let offline=false;
const key=r=>typeof r==='string'?r:r.url;
async function readResource(r){
  if(offline)throw Error('Simulated offline');
  const relative=decodeURIComponent(new URL(key(r)).pathname.slice(new URL(base).pathname.length))||'index.html';
  return new Response(await fs.readFile(path.join(root,relative)));
}
const caches={
  async open(name){
    if(!stores.has(name))stores.set(name,new Map());
    const store=stores.get(name);
    return {async addAll(urls){for(const url of urls)store.set(url,await readResource(url));},async put(r,response){store.set(key(r),response.clone());}};
  },
  async match(r){for(const store of stores.values()){const response=store.get(key(r));if(response)return response.clone();}},
  async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}
};
const self={location:{href:base+'service-worker.js',origin:new URL(base).origin},clients:{async claim(){}},addEventListener:(name,cb)=>listeners[name]=cb};
vm.runInNewContext(await fs.readFile(path.join(root,'service-worker.js'),'utf8'),{self,caches,URL,fetch:readResource});
let install;listeners.install({waitUntil(p){install=p;}});await install;
offline=true;
const data=JSON.parse(await fs.readFile(path.join(root,'data/manual.json'),'utf8'));
const imageFiles=[...new Set([...data.faults,...data.maintenance].flatMap(item=>(item.procedure||[]).map(block=>block.image).filter(Boolean)).map(file=>file.replace(/^\.\//,'')))];
for(const file of ['index.html','data/manual.json',...imageFiles]){
  let response;listeners.fetch({request:{url:base+file,method:'GET',mode:'cors',destination:file.endsWith('.png')?'image':file.endsWith('.html')?'document':''},respondWith(p){response=p;}});
  const result=await response;assert.equal(result.status,200);const bytes=Buffer.from(await result.arrayBuffer());
  assert.deepEqual(bytes,await fs.readFile(path.join(root,file)));console.log('Offline cache simulation PASS: '+file);
}
assert.ok(stores.has('welding-guide-108-v17'));
console.log('PASS: unchanged worker policy installs new assets and serves new data/images without network (simulation, not real browser offline test)');
