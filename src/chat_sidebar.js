'use strict';
const vscode=require('vscode');
const crypto=require('node:crypto');
const {IPCRouter}=require('./ipc');
const {renderMessage}=require('./chat_render');
class DSHChatSidebar{
 constructor({getController,openSettings}){this.getController=getController;this.openSettings=openSettings;this.view=null}
 resolveWebviewView(view){
  this.view=view;
  const nonce=crypto.randomBytes(16).toString('base64');
  view.webview.options={enableScripts:true};
  view.webview.html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">
body{color:var(--vscode-foreground);font:var(--vscode-font-size) var(--vscode-font-family);margin:0;display:flex;flex-direction:column;height:100vh}
header{padding:12px;border-bottom:1px solid var(--vscode-panel-border);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#status{font-size:12px;color:var(--vscode-descriptionForeground);flex:1}
#messages{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.bubble{padding:10px;border-radius:7px;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--vscode-panel-border)}
pre{overflow:auto;white-space:pre}p{margin:4px 0}button:disabled{opacity:.5;cursor:default}
.user{background:var(--vscode-input-background)}.assistant{background:var(--vscode-editor-background)}
footer{padding:10px;border-top:1px solid var(--vscode-panel-border)}
textarea{box-sizing:border-box;width:100%;min-height:72px;resize:vertical;padding:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border)}
button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:0;padding:7px 11px;border-radius:4px;cursor:pointer}
button:focus-visible{outline:2px solid var(--vscode-focusBorder)}
.actions{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
small{color:var(--vscode-descriptionForeground)}
#approval{border:1px solid var(--vscode-editorWarning-foreground);padding:8px;margin:8px;display:none}
</style></head><body>
<header><strong>DSH Chat</strong><span id="status" aria-live="polite">未连接</span>
<button id="connect">连接</button><button id="newSession">新会话</button><button id="model">模型</button><button id="sessions">会话</button><button id="settings">设置</button></header>
<small id="scope" aria-live="polite">同站点支持保留会话切换模型；跨站点隔离会话。恢复不回放旧消息。</small>
<div id="messages" role="log" aria-live="polite"><small>先绑定工作区并配置 AI 站点，再连接 DSH。</small></div>
<div id="approval" role="group" aria-label="工具执行审批"><strong>工具权限请求</strong><p id="approvalText"></p><div class="actions" id="approvalOptions"></div></div>
<footer><textarea id="prompt" aria-label="发送给 DSH 的消息" placeholder="输入消息…" maxlength="16000"></textarea>
<div class="actions"><button id="send">发送</button><button id="cancel">停止</button><button id="disconnect">断开</button></div></footer>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
const status=document.getElementById('status'),messages=document.getElementById('messages');
const prompt=document.getElementById('prompt');
const pending=new Map();let requestSeq=0,lastSequence=0,streamId=null,activeSession=null,activeTurn=null,busy=false;
const channelId=crypto.randomUUID();
const post=(type,payload={})=>{const requestId=channelId+'-'+(++requestSeq);pending.set(requestId,type);vscode.postMessage({version:1,requestId,type,payload})};
const setBusy=value=>{busy=value;for(const id of ['send','model','sessions','newSession','connect'])document.getElementById(id).disabled=value};
const renderMessage=${renderMessage.toString()};
document.getElementById('connect').onclick=()=>{status.textContent='正在连接…';post('connect')};
document.getElementById('newSession').onclick=()=>{post('connect',{resume:false})};
document.getElementById('settings').onclick=()=>post('settings');
document.getElementById('model').onclick=()=>post('selectProfile');
document.getElementById('sessions').onclick=()=>post('listSessions');
document.getElementById('disconnect').onclick=()=>post('disconnect');
document.getElementById('cancel').onclick=()=>post('cancel');
document.getElementById('send').onclick=()=>{const text=prompt.value.trim();if(text){post('prompt',{text});setBusy(true)}};
prompt.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('send').click()}});
let activeAssistant=null;const tools=new Map();
function append(text,role){const item=document.createElement('div');item.className='bubble '+role;item.dataset.text=text;renderMessage(item,text);messages.append(item);messages.scrollTop=messages.scrollHeight;return item}
function appendChunk(text){if(!activeAssistant)activeAssistant=append('','assistant');activeAssistant.dataset.text=(activeAssistant.dataset.text+text).slice(0,262144);renderMessage(activeAssistant,activeAssistant.dataset.text);messages.scrollTop=messages.scrollHeight}
window.addEventListener('message',e=>{
 const m=e.data;if(!m||m.version!==1)return;
 if(typeof m.requestId==='string'){
  const type=pending.get(m.requestId);if(!type)return;pending.delete(m.requestId);
  if(!m.ok){status.textContent=m.error?.code||'操作失败';append(m.error?.message||'操作失败','assistant');if(type==='prompt'&&m.error?.code!=='UNKNOWN_RESULT'&&!activeTurn)setBusy(false)}
  return;
 }
 if(typeof m.event!=='string'||typeof m.streamId!=='string'||!Number.isInteger(m.sequence))return;
 if(m.streamId!==streamId){if(!['connected','disconnected','snapshot'].includes(m.event))return;streamId=m.streamId;lastSequence=0;}
 if(m.sequence<=lastSequence)return;
 lastSequence=m.sequence;const p=m.payload||{};const type=m.event;
 if(['update','tool','turnComplete','turnError'].includes(type)&&(m.sessionId!==activeSession||m.turnId!==activeTurn))return;

 if(type==='modelChanged'){status.textContent='已连接 · '+p.model+' · '+p.sessionId;setBusy(false)}
 if(type==='snapshot'){activeSession=m.sessionId;activeTurn=m.turnId;setBusy(p.busy||p.unknown);status.textContent=p.unknown?'结果未知，请断开后确认':p.connected?'已连接 · '+p.model:'未连接'}
 if(type==='connected'){pending.clear();activeAssistant=null;activeSession=m.sessionId;activeTurn=null;tools.clear();messages.replaceChildren();setBusy(false);status.textContent='已连接 · '+(p.model||'')+' · '+(p.sessionId||'')}
 if(type==='disconnected'){pending.clear();activeAssistant=null;activeSession=null;activeTurn=null;setBusy(false);status.textContent='未连接';document.getElementById('approval').style.display='none'};
 if(type==='turnStart'){activeAssistant=null;activeTurn=m.turnId;prompt.value='';setBusy(true);append(p.text||'','user');status.textContent='正在生成…'}
 if(type==='update'){const value=p.update||{};const text=value.content?.text||value.text||value.message?.content?.text||'';if(text)appendChunk(text)}
 if(type==='turnComplete'){activeAssistant=null;activeTurn=null;setBusy(false);status.textContent=p.result?.stopReason==='cancelled'?'已取消':'已完成'};
 if(type==='cancelling')status.textContent='正在取消…';
 if(type==='turnError'){activeAssistant=null;activeTurn=null;setBusy(true);document.getElementById('disconnect').focus();status.textContent='结果未知，请断开后确认';append(p.message||'未知错误','assistant')}
 if(type==='connectionLost'){activeAssistant=null;activeTurn=null;setBusy(true);status.textContent='连接已中断，请断开后重连';document.getElementById('disconnect').focus()}
 if(type==='tool'){let item=tools.get(p.toolCallId);if(!item){item=append('','assistant');tools.set(p.toolCallId,item)}item.textContent=(p.title||'工具')+' · '+p.status+'\\n'+(p.text||'')}
 if(type==='error'){status.textContent='操作失败';append(p.message||'未知错误','assistant')}
 if(type==='permission'){
  if(m.sessionId!==activeSession||m.turnId!==activeTurn)return;
  const panel=document.getElementById('approval'),actions=document.getElementById('approvalOptions');
  panel.style.display='block';panel.dataset.ticket=p.id;document.getElementById('approvalText').textContent=p.summary||'请求执行工具';actions.replaceChildren();
  const choose=optionId=>{post('permissionRespond',{ticketId:p.id,optionId});panel.style.display='none'};
  for(const opt of p.options||[]){const b=document.createElement('button');b.textContent=opt.name;b.onclick=()=>choose(opt.optionId);actions.append(b)}
  const reject=document.createElement('button');reject.textContent='拒绝';reject.onclick=()=>choose(null);actions.append(reject);reject.focus();
 }
 if(type==='permissionExpired'&&document.getElementById('approval').dataset.ticket===p.id)document.getElementById('approval').style.display='none';
});
post('status');
</script></body></html>`;
  const router=new IPCRouter({post:message=>view.webview.postMessage(message),dispatch:async(type,p)=>{
   if(type==='settings'){await this.openSettings();return {}}
   if(type==='setupProject'||type==='manageProfiles'){await vscode.commands.executeCommand(type==='setupProject'?'dshWorkspace.setup':'dshWorkspace.manageProfiles');return {}}
   if(type==='selectProfile'){
    const controller=this.getController();if(controller.busy||controller.unknown)throw Error('当前会话尚未结束');
    const selected=await vscode.commands.executeCommand('dshWorkspace.selectProfile');
    if(selected)await controller.switchProfile(selected);return {};
   }
   const controller=this.getController();
   if(type==='connect'){if(p.resume===false){const answer=await vscode.window.showWarningMessage('新建会话会断开当前会话，历史仍可在会话列表恢复。',{modal:true},'新建');if(answer!=='新建')return {}}return controller.connect(p);}
   if(type==='disconnect'){await controller.disconnect();return {}}
   if(type==='cancel'){await controller.cancel();return {}}
   if(type==='prompt'){await controller.prompt(p.text);return {}}
   if(type==='permissionRespond'){if(!controller.decide(p.ticketId,p.optionId))throw Error('权限票据已失效');return {}}
   if(type==='status'){controller.snapshot();return controller.status();}
   if(type==='resume')return controller.resume(p.sessionId);
   if(type==='listSessions'){
    const result=await controller.listSessions();
    const options=result.sessions.map(x=>({label:x.title||x.sessionId,description:x.sessionId,sessionId:x.sessionId}));
    const item=await vscode.window.showQuickPick(options,{title:'恢复当前项目、站点和模型的 ACP 会话'});
    if(item)await controller.resume(item.sessionId);return {};
   }
  }});
  this.listener?.dispose();this.listener=view.webview.onDidReceiveMessage(m=>router.receive(m));
  try{this.getController().snapshot()}catch(_){}
  view.onDidDispose(()=>{this.listener?.dispose();if(this.view===view)this.view=null});

 }
 post(event){this.view?.webview.postMessage(event)}
}
module.exports={DSHChatSidebar};
