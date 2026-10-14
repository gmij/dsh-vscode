'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {ACPClient}=require('../src/acp');

test('ACP JSON-RPC truly traverses child-process stdio: init, streamed response, approval, list and resume',async()=>{
 const events=[];
 const client=new ACPClient(process.execPath,process.cwd(),{
  launchArgs:[path.join(__dirname,'fixtures','mock_acp_stdio.js')],
  onEvent:msg=>events.push(msg),
  onPermission:async request=>request.options?.[0]?.optionId
 });
 try{
  const init=await client.start();
  assert.equal(init.protocolVersion,1);
  const session=await client.call('session/new',{cwd:process.cwd(),mcpServers:[]},5000);
  assert.equal(session.sessionId,'fixture-session');
  const prompt=await client.call('session/prompt',{sessionId:session.sessionId,prompt:[{type:'text',text:'hello'}]},5000);
  assert.equal(prompt.stopReason,'end_turn');
  assert(events.some(e=>e.method==='session/update'&&e.params.update.content.text==='ACP integration ok'));
  const list=await client.call('session/list',{cwd:process.cwd()},5000);
  assert.equal(list.sessions[0].sessionId,session.sessionId);
  const resume=await client.call('session/resume',{sessionId:session.sessionId,cwd:process.cwd()},5000);
  assert.equal(resume.sessionId,session.sessionId);
  client.send({jsonrpc:'2.0',method:'session/cancel',params:{sessionId:session.sessionId}});
 }finally{client.close()}
});
