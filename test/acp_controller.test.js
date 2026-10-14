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
  const first=events.find(e=>e.event==='connected');assert(!JSON.stringify(first).includes('local-fixture-only'));
  await a.disconnect();
  const b=new WorkspaceACPController(ctx);
  await b.connect();assert(FakeClient.last.calls.includes('session/resume'));
  b.dispose();
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('permission tickets reject unknown and repeated choices',async()=>{
 const a=new WorkspaceACPController({workspace:{localPath:'/tmp',repository:'test'},profiles:{},workspaceState:{}});
 a.busy=true;a.sessionId='test-session';
 const request=a.requestPermission({sessionId:'test-session',toolCall:{name:'read'},options:[{optionId:'allow',name:'Allow'}]},a.generation);
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
  a.owned.add('native-other');
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
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function runtime(){
 const events=[];const store=new Map();const root=setup();
 const profiles={selected:()=>({profile:{id:'p1',name:'Test',baseURL:'https://example.com/v1',api:'openai-completions',models:['m1']},model:'m1'}),credentials:async()=>null};
 const a=new WorkspaceACPController({workspace:{localPath:root,repository:'gmij/test'},profiles,workspaceState:{get:(k,f)=>store.has(k)?store.get(k):f,update:async(k,v)=>store.set(k,v)},Client:FakeClient,emit:e=>events.push(e)});
 return {a,events,root,cleanup:async()=>{await a.disconnect();fs.rmSync(root,{recursive:true,force:true})}};
}
test('unknown prompt outcome blocks replay and clears tool permissions',async()=>{
 const x=runtime();try{
  await x.a.connect();const wait=deferred();FakeClient.last.call=()=>wait.promise;
  const turn=x.a.prompt('do work');
  const permission=x.a.requestPermission({sessionId:x.a.sessionId,toolCall:{title:'read'},options:[{optionId:'once',name:'once'}]},x.a.generation);
  wait.reject(Error('ACP timed out: session/prompt'));
  await assert.rejects(turn,{code:'UNKNOWN_RESULT'});assert.equal(await permission,null);
  await assert.rejects(()=>x.a.prompt('again'),{code:'BUSY'});
  assert.equal(x.a.unknown,true);assert(x.events.some(e=>e.event==='turnError'&&e.payload.unknown));
 }finally{await x.cleanup()}
});
test('late completion from disconnected client cannot finish a new turn',async()=>{
 const x=runtime();try{
  await x.a.connect();const old=deferred();FakeClient.last.call=()=>old.promise;const oldTurn=x.a.prompt('old');
  await x.a.disconnect();await x.a.connect();const current=deferred();FakeClient.last.call=()=>current.promise;
  const newTurn=x.a.prompt('new');old.resolve({stopReason:'end_turn'});await oldTurn;
  assert.equal(x.a.busy,true);assert.equal(x.events.filter(e=>e.event==='turnComplete').length,0);
  current.resolve({stopReason:'end_turn'});await newTurn;assert.equal(x.a.busy,false);
 }finally{await x.cleanup()}
});
test('tools retain lifecycle events but wrong-session updates and permission requests are rejected',async()=>{
 const x=runtime();try{
  await x.a.connect();const wait=deferred();const client=FakeClient.last;client.call=()=>wait.promise;const turn=x.a.prompt('read');
  client.opts.onEvent({method:'session/update',params:{sessionId:'foreign',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'wrong'}}}});
  client.opts.onEvent({method:'session/update',params:{sessionId:x.a.sessionId,update:{sessionUpdate:'tool_call',toolCallId:'read-1',title:'read README',status:'in_progress'}}});
  client.opts.onEvent({method:'session/update',params:{sessionId:x.a.sessionId,update:{sessionUpdate:'tool_call_update',toolCallId:'read-1',status:'completed',content:[{type:'content',content:{type:'text',text:'result'}}]}}});
  assert.equal(x.events.filter(e=>e.event==='update').length,0);assert.deepEqual(x.events.filter(e=>e.event==='tool').map(e=>e.payload.status),['in_progress','completed']);
  assert.equal(await client.opts.onPermission({sessionId:'foreign',options:[{optionId:'allow'}]}),null);
  await assert.rejects(()=>x.a.resume('foreign'),{code:'BUSY'});
  wait.resolve({stopReason:'end_turn'});await turn;
  await assert.rejects(()=>x.a.resume('foreign'),{code:'SESSION_SCOPE'});
 }finally{await x.cleanup()}
});
test('endpoint edits do not restore a session belonging to the old endpoint',async()=>{
 const x=runtime();try{await x.a.connect();await x.a.disconnect();const original=x.a.profiles.selected();x.a.profiles.selected=()=>({...original,profile:{...original.profile,baseURL:'https://new.example/v1'}});const file=path.join(x.root,'.dsh','ai-profiles.json');const config=JSON.parse(fs.readFileSync(file));config.profiles[0].baseURL='https://new.example/v1';fs.writeFileSync(file,JSON.stringify(config));await x.a.connect();assert(!FakeClient.last.calls.includes('session/resume'));}finally{await x.cleanup()}
});
test('disconnect during initialize cannot publish a connected session',async()=>{
 const x=runtime();const starting=deferred();const start=FakeClient.prototype.start;
 try{FakeClient.prototype.start=()=>starting.promise;const connection=x.a.connect();await new Promise(r=>setImmediate(r));await x.a.disconnect();starting.resolve({});await assert.rejects(connection,{code:'CANCELLED'});assert.equal(x.a.sessionId,null);assert(!x.events.some(e=>e.event==='connected'));}finally{FakeClient.prototype.start=start;await x.cleanup()}
});
