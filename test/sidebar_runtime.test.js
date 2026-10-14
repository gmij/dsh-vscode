'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const Module=require('node:module');const vm=require('node:vm');
function build(){
 const original=Module._load;Module._load=function(id,...args){if(id==='vscode')return {commands:{executeCommand:async()=>null},window:{showQuickPick:async()=>null}};return original.call(this,id,...args)};
 let Sidebar;try{delete require.cache[require.resolve('../src/chat_sidebar')];Sidebar=require('../src/chat_sidebar').DSHChatSidebar}finally{Module._load=original}
 let receive;const view={webview:{postMessage:()=>{},onDidReceiveMessage:f=>{receive=f;return {dispose(){}}}},onDidDispose(){}};
 const sidebar=new Sidebar({getController:()=>({}),openSettings:()=>{}});sidebar.resolveWebviewView(view);return {html:view.webview.html,receive};
}
test('rendered Webview JavaScript compiles, rather than only checking its template source',()=>{
 const {html}=build();const script=html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)[1];
 assert.doesNotThrow(()=>new vm.Script(script));assert(!html.includes('innerHTML='));
 assert.equal(require('../package.json').contributes.views.dshWorkspace[0].type,'webview');
});
module.exports={build};
function harness(){
 const {html}=build();const requests=[];let listener;
 const nodes=new Map();
 class Element{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.style={};this.attributes={};this.disabled=false;this.value='';this._text=''}
  set textContent(text){this._text=String(text);this.children=[]}get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
  append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this._text='';this.children=nodes}
  setAttribute(k,v){this.attributes[k]=v}focus(){this.ownerDocument.activeElement=this}
  addEventListener(){}click(){if(!this.disabled)this.onclick?.()}
 }
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element('div',document));return nodes.get(id)},createElement:tag=>new Element(tag,document)};
 let copied='';
 vm.runInNewContext(html.match(/<script nonce="[^"]+">([\s\S]*)<\/script>/)[1],{document,crypto:{randomUUID:()=> 'test-channel'},acquireVsCodeApi:()=>({postMessage:m=>requests.push(m)}),window:{addEventListener:(name,cb)=>{listener=cb}},navigator:{clipboard:{writeText:async text=>{copied=text}}}});
 let sequence=0;const send=(event,payload={},sessionId='s1',turnId=null)=>listener({data:{version:1,streamId:'host-1',event,sequence:++sequence,sessionId,turnId,payload}});
 return {document,requests,send,nodes,get copied(){return copied}};
}
test('actual Webview script renders inert Markdown/code, rejects stale turns and handles approval expiry',async()=>{
 const h=harness();h.send('connected',{model:'model',sessionId:'s1'});
 h.nodes.get('prompt').value='hello';h.nodes.get('send').click();assert.equal(h.requests.at(-1).type,'prompt');
 h.send('turnStart',{text:'hello'},'s1','t1');
 h.send('update',{update:{content:{text:'ignored'}}},'s1','old-turn');
 assert.equal(h.nodes.get('messages').children.length,1);
 h.send('update',{update:{content:{text:'**bold**\n```js\n<img src=x onerror=bad()>\n```'}}},'s1','t1');
 const assistant=h.nodes.get('messages').children[1];assert(assistant.textContent.includes('<img src=x onerror=bad()>'));
 assert(!assistant.children.some(x=>x.tagName==='img'));
 const copy=assistant.children.find(x=>x.tagName==='button');await copy.onclick();assert(h.copied.includes('<img'));
 h.send('permission',{id:'ticket',summary:'read',options:[{optionId:'once',name:'允许一次'}]},'s1','t1');
 assert.equal(h.nodes.get('approval').style.display,'block');h.send('permissionExpired',{id:'another'},'s1','t1');assert.equal(h.nodes.get('approval').style.display,'block');
 h.send('permissionExpired',{id:'ticket'},'s1','t1');assert.equal(h.nodes.get('approval').style.display,'none');
 h.send('turnComplete',{result:{stopReason:'end_turn'}},'s1','t1');assert.equal(h.nodes.get('send').disabled,false);
});
test('unknown completion leaves send disabled until explicit disconnect',()=>{
 const h=harness();h.send('connected',{sessionId:'s1'});h.send('turnStart',{text:'hello'},'s1','t1');h.send('turnError',{message:'unknown',unknown:true},'s1','t1');assert.equal(h.nodes.get('send').disabled,true);h.send('disconnected',{},null);assert.equal(h.nodes.get('send').disabled,false);
});
