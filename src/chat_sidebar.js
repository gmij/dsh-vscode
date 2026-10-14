'use strict';
const vscode=require('vscode');
const crypto=require('node:crypto');
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
<button id="connect">连接</button><button id="model">模型</button><button id="sessions">会话</button><button id="settings">设置</button></header>
<div id="messages" role="log" aria-live="polite"><small>先绑定工作区并配置 AI 站点，再连接 DSH。</small></div>
<div id="approval" role="group" aria-label="工具执行审批"><strong>工具权限请求</strong><p id="approvalText"></p><div class="actions" id="approvalOptions"></div></div>
<footer><textarea id="prompt" aria-label="发送给 DSH 的消息" placeholder="输入消息…" maxlength="16000"></textarea>
<div class="actions"><button id="send">发送</button><button id="cancel">停止</button><button id="disconnect">断开</button></div></footer>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
const status=document.getElementById('status'),messages=document.getElementById('messages');
const prompt=document.getElementById('prompt');
const post=(action,extra={})=>vscode.postMessage({action,...extra});
document.getElementById('connect').onclick=()=>{status.textContent='正在连接…';post('connect')};
document.getElementById('settings').onclick=()=>post('settings');
document.getElementById('model').onclick=()=>post('model');
document.getElementById('sessions').onclick=()=>post('sessions');
document.getElementById('disconnect').onclick=()=>post('disconnect');
document.getElementById('cancel').onclick=()=>post('cancel');
document.getElementById('send').onclick=()=>{const text=prompt.value.trim();if(text){prompt.value='';post('prompt',{text})}};
prompt.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('send').click()}});
let activeAssistant=null;
function append(text,role){const item=document.createElement('div');item.className='bubble '+role;item.textContent=text;messages.append(item);messages.scrollTop=messages.scrollHeight;return item}
function appendChunk(text){if(!activeAssistant)activeAssistant=append('','assistant');activeAssistant.textContent+=text;messages.scrollTop=messages.scrollHeight}
window.addEventListener('message',e=>{
 const m=e.data;if(!m||typeof m.type!=='string')return;const p=m.payload||{};
 if(m.type==='connected')status.textContent='已连接 · '+(p.model||'')+' · '+(p.sessionId||'');
 if(m.type==='disconnected'){activeAssistant=null;status.textContent='未连接'};
 if(m.type==='turnStart'){activeAssistant=null;append(p.text||'','user');status.textContent='正在生成…'}
 if(m.type==='update'){const value=p.update||{};const text=value.content?.text||value.text||value.message?.content?.text||'';if(text)appendChunk(text)}
 if(m.type==='turnComplete'){activeAssistant=null;status.textContent='已完成'};
 if(m.type==='cancelling')status.textContent='正在取消…';
 if(m.type==='turnError'){activeAssistant=null;status.textContent='请求失败';append(p.message||'未知错误','assistant')}
 if(m.type==='error'){status.textContent='操作失败';append(p.message||'未知错误','assistant')}
 if(m.type==='permission'){
  const panel=document.getElementById('approval'),actions=document.getElementById('approvalOptions');
  panel.style.display='block';document.getElementById('approvalText').textContent=p.summary||'请求执行工具';actions.replaceChildren();
  const choose=optionId=>{post('decide',{id:p.id,optionId});panel.style.display='none'};
  for(const opt of p.options||[]){const b=document.createElement('button');b.textContent=opt.name;b.onclick=()=>choose(opt.optionId);actions.append(b)}
  const reject=document.createElement('button');reject.textContent='拒绝';reject.onclick=()=>choose(null);actions.append(reject);
 }
 if(m.type==='permissionExpired')document.getElementById('approval').style.display='none';
});
</script></body></html>`;
  view.webview.onDidReceiveMessage(async m=>{
   if(!m||typeof m.action!=='string')return;
   if(m.action==='settings'){this.openSettings();return}
   if(m.action==='model'){try{await vscode.commands.executeCommand('dshWorkspace.selectProfile');await this.getController().connect()}catch(err){this.post({type:'error',payload:{message:err.message}})}return}
   if(m.action==='sessions'){
    try{const result=await this.getController().listSessions();const sessions=Array.isArray(result?.sessions)?result.sessions:[];
      const options=sessions.filter(x=>typeof x.sessionId==='string').map(x=>({label:x.title||x.sessionId,description:x.sessionId,sessionId:x.sessionId}));
      const item=await vscode.window.showQuickPick(options,{title:'恢复 ACP 会话'});
      if(item)await this.getController().resume(item.sessionId);
    }catch(err){this.post({type:'error',payload:{message:err.message}})}return;
   }
   const controller=this.getController();
   try{
    if(m.action==='connect')await controller.connect();
    else if(m.action==='disconnect')await controller.disconnect();
    else if(m.action==='cancel')await controller.cancel();
    else if(m.action==='prompt')await controller.prompt(m.text);
    else if(m.action==='decide')controller.decide(m.id,m.optionId);
   }catch(err){this.post({type:'error',payload:{message:err.message}})}
  });
 }
 post(event){this.view?.webview.postMessage(event)}
}
module.exports={DSHChatSidebar};
