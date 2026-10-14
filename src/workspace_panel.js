'use strict';
const vscode=require('vscode');

function html(webview){
 const nonce=require('node:crypto').randomBytes(16).toString('base64');
 return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>DSH 工作区</title>
<style nonce="${nonce}">
body{padding:20px;font:var(--vscode-font-size) var(--vscode-font-family);color:var(--vscode-foreground);max-width:900px;margin:auto}
h1{font-size:22px}h2{font-size:15px;margin-top:26px}
section{border:1px solid var(--vscode-panel-border);padding:16px;border-radius:8px;margin:12px 0}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
button{border:0;border-radius:4px;padding:8px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);cursor:pointer}
button:hover{background:var(--vscode-button-hoverBackground)}button:focus-visible{outline:2px solid var(--vscode-focusBorder)}
button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
small{color:var(--vscode-descriptionForeground)}
.value{font-weight:600;overflow-wrap:anywhere}
#warning{color:var(--vscode-editorWarning-foreground)}
</style></head><body>
<h1>DSH 工作区</h1><p>配置项目与 AI 模型，再连接本地 DSH ACP。此页面不会接收或显示 API Key。</p>
<section><h2>当前项目</h2><div id="project" class="value" aria-live="polite">正在读取…</div><div id="folder"></div>
<div class="row"><button data-command="setup">绑定 Git 项目</button><button class="secondary" data-command="status">检查项目</button></div></section>
<section><h2>AI 模型配置</h2><div id="model" class="value" aria-live="polite">正在读取…</div>
<div class="row"><button data-command="manageProfiles">管理 AI 站点</button><button class="secondary" data-command="selectProfile">切换模型</button>
<button class="secondary" data-command="importProjectProfiles">从项目加载配置</button><button class="secondary" data-command="saveProjectProfiles">保存至项目</button></div>
<p><small>项目配置可能含有明文密钥。请勿将 .dsh/ai-profiles.json 提交到 Git。</small></p></section>
<section><h2>ACP 会话</h2><p>v0.4.0 当前从已有命令打开真实 ACP；v0.5.0 将提供持续显示的聊天侧栏。</p>
<div class="row"><button data-command="chat">启动 ACP 对话</button><button class="secondary" data-command="refresh">刷新状态</button></div></section>
<p id="warning" role="status"></p>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
document.querySelectorAll('button[data-command]').forEach(b=>b.addEventListener('click',()=>vscode.postMessage({type:'command',command:b.dataset.command})));
window.addEventListener('message',event=>{
 const msg=event.data;
 if(!msg||msg.type!=='status')return;
 document.getElementById('project').textContent=msg.repository||'尚未绑定项目';
 document.getElementById('folder').textContent=msg.folder||'请选择本地 Git 工作目录';
 document.getElementById('model').textContent=msg.model||'尚未选择 AI 模型';
 document.getElementById('warning').textContent=msg.warning||'';
});
vscode.postMessage({type:'command',command:'refresh'});
</script></body></html>`;
}

function openWorkspacePanel(context,{getStatus}){
 const panel=vscode.window.createWebviewPanel('dshWorkspace.settings','DSH 工作区设置',vscode.ViewColumn.One,{enableScripts:true,retainContextWhenHidden:true});
 panel.webview.html=html(panel.webview);
 const allowed={
   setup:'dshWorkspace.setup',
   status:'dshWorkspace.status',
   manageProfiles:'dshWorkspace.manageProfiles',
   selectProfile:'dshWorkspace.selectProfile',
   importProjectProfiles:'dshWorkspace.importProjectProfiles',
   saveProjectProfiles:'dshWorkspace.saveProjectProfiles',
   chat:'dshWorkspace.chat'
 };
 const refresh=()=>panel.webview.postMessage({type:'status',...getStatus()});
 panel.webview.onDidReceiveMessage(async message=>{
   if(!message||message.type!=='command'||typeof message.command!=='string')return;
   if(message.command==='refresh'){refresh();return;}
   const command=allowed[message.command];
   if(!command)return;
   try{await vscode.commands.executeCommand(command)}
   catch(err){vscode.window.showErrorMessage('DSH 操作失败：'+err.message)}
   finally{refresh()}
 },null,context.subscriptions);
 return panel;
}
module.exports={openWorkspacePanel};
