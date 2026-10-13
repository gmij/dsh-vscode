'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ACPClient}=require('../src/acp');

test('ACP resolves pending JSON-RPC calls, preserving split frame boundaries', async () => {
 const client=new ACPClient('unused','/tmp');
 const sent=[];
 client.send=value=>sent.push(value);
 const result=client.call('initialize',{protocolVersion:1},500);
 assert.equal(sent.length,1);
 const id=sent[0].id;
 const json=JSON.stringify({jsonrpc:'2.0',id,result:{protocolVersion:1}})+'\n';
 client.receive(json.slice(0,12));client.receive(json.slice(12));
 assert.deepEqual(await result,{protocolVersion:1});
 client.close();
});

test('ACP rejects tool permission by default rather than authorizing execution', () => {
 const client=new ACPClient('unused','/tmp');
 let response;
 client.send=value=>{response=value;};
 client.receive(JSON.stringify({jsonrpc:'2.0',id:22,method:'session/request_permission',params:{}})+'\n');
 assert.equal(response.id,22);
 assert.equal(response.result.outcome.outcome,'cancelled');
 client.close();
});

test('ACP surfaces JSON-RPC model or authorization errors unchanged', async () => {
 const client=new ACPClient('unused','/tmp');
 let id;
 client.send=value=>{id=value.id;};
 const result=client.call('session/prompt',{sessionId:'test'},500);
 client.receive(JSON.stringify({jsonrpc:'2.0',id,error:{code:-32603,message:'forbidden: Copilot Requests permission missing'}})+'\n');
 await assert.rejects(result,/Copilot Requests permission missing/);
 client.close();
});
