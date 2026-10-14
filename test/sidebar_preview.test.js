'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('M1 sidebar has native Activity Bar entry, coalesced streaming, model/session controls',()=>{
 const pkg=require('../package.json');
 assert(pkg.contributes.views.dshWorkspace.some(x=>x.id==='dshWorkspace.chatView'));
 const s=fs.readFileSync(path.join(root,'src/chat_sidebar.js'),'utf8');
 for(const feature of ["post('model')","post('sessions')","post('cancel')","post('connect')","post('settings')","function appendChunk(text)"]){
  assert(s.includes(feature),feature);
 }
 assert(s.includes("activeAssistant.textContent+=text"));
 assert(s.includes("default-src 'none'"));
 assert(!s.includes('innerHTML='));
});
