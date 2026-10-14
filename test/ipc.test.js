'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {IPCRouter}=require('../src/ipc');
const request=(type,payload={},requestId='same')=>({version:1,requestId,type,payload});
test('duplicate in-flight prompt is never replayed, and arbitrary fields are rejected',async()=>{
 let complete;let count=0;const responses=[];
 const router=new IPCRouter({post:m=>responses.push(m),dispatch:()=>{count++;return new Promise(r=>complete=r)}});
 const first=router.receive(request('prompt',{text:'hello'}));
 await router.receive(request('prompt',{text:'changed'}));
 await router.receive(request('prompt',{text:'hello',cwd:'/another-project'},'invalid'));
 assert.equal(count,1);assert.deepEqual(responses.map(x=>x.error.code),['DUPLICATE_REQUEST','INVALID_REQUEST']);
 complete({});await first;
 await router.receive(request('prompt',{text:'hello'}));assert.equal(count,1);
});
test('IPC failure does not expose provider diagnostics or secrets',async()=>{
 const responses=[];const router=new IPCRouter({post:m=>responses.push(m),dispatch:()=>{throw Error('Bearer private-key fixture')}});
 await router.receive(request('connect'));
 assert.equal(responses[0].ok,false);assert(!JSON.stringify(responses).includes('private-key'));
});
