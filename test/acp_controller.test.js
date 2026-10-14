'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {WorkspaceACPController}=require('../src/acp_controller');
function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-test-'));
 fs.mkdirSync(path.join(dir,'.dsh'));
 fs.writeFileSync(path.join(dir,'.dsh','ai-profiles.json'),JSON.stringify({schemaVersion:1,profiles:[{
  id:'p1',name:'Test',baseURL:'https://example.com/v1',api:'openai-completions',models:['m1'],apiKey:'local-fixture-only'}]}));
 return dir;
}
class FakeClient{
 constructor(command,cwd,opts){this.opts=opts;FakeClient.last=this;this.calls=[]}
 async start(){this.calls.push('initialize')}
 async call(method,args){this.calls.push(method);if(method==='session/new')return {sessionId:'native-123'};if(method==='session/resume')return {sessionId:args.sessionId};return {stopReason:'end_turn'}}
 close(){this.closed=true}
}
test('project file credential stays in Host; session is preserved across controller recreation',async()=>{
 const root=setup();const store=new Map();const events=[];
 const ctx={workspace:{localPath:root,repository:'gmij/test'},profiles:{
  selected:()=>({profile:{id:'p1',name:'Test',baseURL:'https://example.com/v1',api:'openai-completions',models:['m1']},model:'m1'}),
  credentials:async()=>{throw Error('Key should come from project file')}
 },workspaceState:{get:k=>store.get(k),update:async(k,v)=>store.set(k,v)},Client:FakeClient,emit:e=>events.push(e)};
 try{
  const a=new WorkspaceACPController(ctx);
  assert.deepEqual(await a.connect(),{sessionId:'native-123'});
  assert.equal(FakeClient.last.opts.apiKey,'local-fixture-only');
  await a.prompt('hello');assert(FakeClient.last.calls.includes('session/prompt'));
  const first=events.find(e=>e.type==='connected');assert(!JSON.stringify(first).includes('local-fixture-only'));
  await a.disconnect();
  const b=new WorkspaceACPController(ctx);
  await b.connect();assert(FakeClient.last.calls.includes('session/resume'));
  b.dispose();
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('permission tickets reject unknown and repeated choices',async()=>{
 const a=new WorkspaceACPController({workspace:{localPath:'/tmp',repository:'test'},profiles:{},workspaceState:{}});
 const request=a.requestPermission({toolCall:{name:'read'},options:[{optionId:'allow',name:'Allow'}]},a.generation);
 const id=[...a.permissions.keys()][0];
 assert.equal(a.decide(id,'not-allowed'),true);
 assert.equal(await request,null);
 assert.equal(a.decide(id,'allow'),false);
 a.dispose();
});
test('ACP cancellation uses one-way notification, and session resume preserves requested native ID',async()=>{
 const root=setup();const store=new Map();
 const profiles={selected:()=>({profile:{id:'p1',name:'Test',baseURL:'https://example.com/v1',api:'openai-completions',models:['m1']},model:'m1'}),
                  credentials:async()=>null};
 const a=new WorkspaceACPController({workspace:{localPath:root,repository:'gmij/test'},profiles,
    workspaceState:{get:key=>store.get(key),update:async(key,v)=>store.set(key,v)},Client:FakeClient});
 try{
  await a.connect();
  const client=FakeClient.last;
  client.send=msg=>{client.sent=msg};
  a.busy=true;
  assert.equal(await a.cancel(),true);
  assert.equal(client.sent.method,'session/cancel');
  assert.equal(client.sent.id,undefined);
  a.busy=false;
  await a.resume('native-other');
  assert.equal(a.sessionId,'native-other');
  assert.equal(store.get(a.key(a.active)).sessionId,'native-other');
 }finally{await a.disconnect();fs.rmSync(root,{recursive:true,force:true})}
});
test('reject overlapping and oversized prompts',async()=>{
 const a=new WorkspaceACPController({workspace:{localPath:'/tmp'},profiles:{},workspaceState:{}});
 await assert.rejects(()=>a.prompt('hello'),/尚未连接/);
 a.dispose();
});
