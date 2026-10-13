'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Profiles,validate,createPatch}=require('../src/profiles');

function fakeContext(){
 const data=new Map(),secret=new Map();
 return {data,secret,globalState:{get:(k,d)=>data.get(k)??d,update:async(k,v)=>data.set(k,v)},
   secrets:{get:async(k)=>secret.get(k),store:async(k,v)=>secret.set(k,v),delete:async(k)=>secret.delete(k)}};
}
const alpha={id:'workspace-alpha',name:'Provider A',baseURL:'https://a.example.com/v1',api:'openai-responses',models:['gpt-test-1','gpt-test-2']};
const beta={id:'workspace-beta',name:'Provider B',baseURL:'https://b.example.net/v1',api:'openai-completions',models:['model-b']};
test('multiple profiles retain models while keys remain in secret storage',async()=>{
 const ctx=fakeContext(),manager=new Profiles(ctx);
 await manager.upsert(alpha,'SECRET_A');await manager.upsert(beta,'SECRET_B');
 assert.equal(manager.all().length,2);
 assert.equal(await manager.credentials('workspace-alpha'),'SECRET_A');
 assert.equal(await manager.credentials('workspace-beta'),'SECRET_B');
 assert.equal(JSON.stringify([...ctx.data]),JSON.stringify([...ctx.data]).replace('NEVER','NEVER'));
 assert.equal(JSON.stringify(manager.all()).includes('SECRET_A'),false);
 await manager.select('workspace-alpha','gpt-test-2');
 assert.equal(manager.selected().model,'gpt-test-2');
 await manager.upsert({...alpha,name:'Renamed'},'');
 assert.equal(await manager.credentials('workspace-alpha'),'SECRET_A');
 await manager.remove('workspace-alpha');
 assert.equal(await manager.credentials('workspace-alpha'),undefined);
 assert.equal(manager.selected(),null);
});
test('model patch explicitly selects isolated provider, endpoint and model without embedding API key',()=>{
 const patch=createPatch(beta,'model-b');
 assert.deepEqual(patch[0].config,{provider:'workspace-beta',model:'model-b'});
 const provider=patch[2].config.providers['workspace-beta'];
 assert.equal(provider.api,'openai-completions');
 assert.equal(provider.apiKeyEnv,'DSH_WORKSPACE_API_KEY');
 assert.equal(provider.baseURL,beta.baseURL);
 assert.deepEqual(provider.models,[{id:'model-b'}]);
 assert.equal(JSON.stringify(patch).includes('SECRET'),false);
});
test('rejects credential-bearing URLs, HTTP endpoints and unknown models',()=>{
 assert.throws(()=>validate({...alpha,baseURL:'http://example.org/v1'}),/HTTPS/);
 assert.throws(()=>validate({...alpha,baseURL:'https://mykey@example.org/v1'}),/不允许/);
 assert.throws(()=>createPatch(alpha,'not-configured'),/不在站点清单/);
});
