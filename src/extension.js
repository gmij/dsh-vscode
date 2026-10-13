'use strict';
const vscode=require('vscode');
const {verifyBinding,run,parseGitHubRemote}=require('./project');
const {ACPClient}=require('./acp');
const KEY='dshWorkspace.project.v1';
const EXECUTION_REPO='gmij/dsh-actions-connectivity';
function activate(context) {
 const project=()=>context.workspaceState.get(KEY);
 async function setup() {
  const selected=await vscode.window.showOpenDialog({canSelectFiles:false,canSelectFolders:true,canSelectMany:false,openLabel:'选择本地 Git 工作目录'});
  if(!selected?.[0])return;
  const localPath=selected[0].fsPath;
  let origin='';
  try{origin=await run('git',['remote','get-url','origin'],localPath);}catch(_){}
  const repository=await vscode.window.showInputBox({title:'GitHub 仓库',prompt:'owner/repo (与 origin 一致)',value:parseGitHubRemote(origin)||'',validateInput:v=>/^[\w.-]+\/[\w.-]+$/.test(v)?null:'请输入 owner/repo'});
  if(!repository)return;
  try{
   const binding={provider:'github',repository,localPath};
   const result=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'验证仓库只读权限'},()=>verifyBinding(binding));
   await context.workspaceState.update(KEY,{...binding,verifiedAt:new Date().toISOString(),defaultBranch:result.branch});
   vscode.window.showInformationMessage('DSH Workspace 已绑定 '+result.repository);
  }catch(err){vscode.window.showErrorMessage('绑定失败: '+err.message+'。检查 git、gh auth login');}
 }
 async function status(){
  if(!project()){vscode.window.showWarningMessage('请先执行 Setup Project');return;}
  try{
   const result=await verifyBinding(project());
   const channel=vscode.window.createOutputChannel('DSH Workspace');
   channel.clear();channel.appendLine('仓库: '+result.repository+'\n分支: '+result.branch+'\n目录: '+project().localPath);
   channel.appendLine('Issues: '+JSON.stringify(result.issues,null,2));
   channel.appendLine('Milestones: '+JSON.stringify(result.milestones,null,2));channel.show();
  }catch(err){vscode.window.showErrorMessage('检查失败: '+err.message);}
 }
 async function openDiscussion(){
  if(!project()){vscode.window.showWarningMessage('请先绑定项目');return;}
  await vscode.env.openExternal(vscode.Uri.parse('https://github.com/'+project().repository+'/discussions'));
 }
 async function runAgent(){
  if(!project()){vscode.window.showWarningMessage('请先绑定项目');return;}
  const ok=await vscode.window.showWarningMessage('将在 '+EXECUTION_REPO+' 触发连通性测试（非当前项目），是否继续？',{modal:true},'继续');
  if(ok!=='继续')return;
  const task=await vscode.window.showInputBox({value:'Reply with exactly DSH_COPILOT_OK. Do not use tools.',prompt:'测试任务'});
  if(!task)return;
  try{
   await run('gh',['workflow','run','run-agent.yml','--repo',EXECUTION_REPO,'--field','model=gpt-5.4-mini','--field','agent=connectivity','--field','task='+task],project().localPath);
   vscode.window.showInformationMessage('已请求运行；请在 Actions 页面检查结果');
  }catch(err){vscode.window.showErrorMessage('调度失败: '+err.message);}
 }
 async function chat() {
  const bound=project();
  if(!bound){vscode.window.showWarningMessage('请先执行 Setup Project');return;}
  const folder=bound.localPath;
  const fs=require('node:fs');
  if(!folder || !fs.existsSync(folder)){vscode.window.showErrorMessage('绑定的本地工作目录不存在');return;}
  const config=vscode.workspace.getConfiguration('dshWorkspace');
  const command=config.get('dshCommand','dsh');
  const provider=config.get('provider','');
  const model=config.get('model','');
  const output=vscode.window.createOutputChannel('DSH ACP Chat');
  output.show(true);
  output.appendLine('项目: '+bound.repository+'\\n工作目录: '+folder+'\\n采用真实 DSH ACP；工具权限默认拒绝。');
  const client=new ACPClient(command, folder, {provider, model,
    onUpdate: t=>output.appendLine(t),
    onPermission: async request => {
      const options=(request.options||[]).filter(x=>typeof x.optionId==='string');
      const title=JSON.stringify(request.toolCall||{}).slice(0,350);
      output.appendLine('权限审批: '+title);
      if(!options.length)return null;
      const choices=options.map(x=>({label:x.name||x.optionId,description:x.kind||'',id:x.optionId}));
      choices.push({label:'拒绝 / 取消',description:'不执行此次工具请求',id:null});
      const selected=await vscode.window.showQuickPick(choices,{
        title:'DSH 工具执行权限审批：'+title.slice(0,85),
        placeHolder:'请审查命令及影响，再选择是否批准；关闭窗口即拒绝'
      });
      return selected?.id || null;
    }
  });
  try{
   await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'启动 DSH ACP'},()=>client.start());
   const key='dshWorkspace.session.v1:'+folder;
   let saved=context.workspaceState.get(key);
   let session=null;
   if(saved && saved.repository===bound.repository && saved.localPath===folder){
    try{
     session=await client.call('session/resume',{sessionId:saved.sessionId,cwd:folder,mcpServers:[]});
     output.appendLine('已恢复同一 ACP 会话: '+saved.sessionId);
    }catch(err){output.appendLine('恢复失败，不自动替换会话: '+err.message);throw err;}
   } else {
    session=await client.call('session/new',{cwd:folder,mcpServers:[]});
    if(!session?.sessionId)throw new Error('DSH 未返回原生 sessionId');
    await context.workspaceState.update(key,{sessionId:session.sessionId,repository:bound.repository,localPath:folder});
    saved={sessionId:session.sessionId};output.appendLine('已创建 ACP 会话: '+session.sessionId);
   }
   while(true){
    const message=await vscode.window.showInputBox({title:'DSH ACP 连续对话',prompt:'输入消息；按 Esc 结束（会话可在下次恢复）',placeHolder:'向当前项目的 DSH 提问'});
    if(!message)break;
    output.appendLine('\\n你: '+message);
    const result=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'DSH 正在回复...'},()=>client.call('session/prompt',{sessionId:saved.sessionId,prompt:[{type:'text',text:message}]}));
    output.appendLine('本轮完成: '+JSON.stringify(result));
   }
  }catch(err){vscode.window.showErrorMessage('DSH ACP 聊天失败: '+err.message);output.appendLine('错误: '+err.stack);}
  finally{client.close();}
 }
 async function attachExecutionRepo(){
  const choice=await vscode.window.showOpenDialog({canSelectFiles:false,canSelectFolders:true,canSelectMany:false,openLabel:'选择 dsh-actions-connectivity 的本地克隆'});
  if(!choice?.[0])return;
  const folder=choice[0];
  try{
   const origin=await run('git',['remote','get-url','origin'],folder.fsPath);
   if(parseGitHubRemote(origin)?.toLowerCase()!==EXECUTION_REPO.toLowerCase())throw new Error('选择的目录并非 '+EXECUTION_REPO+'；origin='+origin);
   if(vscode.workspace.workspaceFolders?.some(w=>w.uri.toString()===folder.toString())){vscode.window.showInformationMessage('执行仓库已在工作区中');return;}
   const index=vscode.workspace.workspaceFolders?.length||0;
   const changed=vscode.workspace.updateWorkspaceFolders(index,0,{uri:folder,name:'DSH Agent Execution'});
   if(changed)vscode.window.showInformationMessage('已将执行仓库加入 VS Code 工作区（不会修改其代码）');
   else vscode.window.showErrorMessage('VS Code 未能修改工作区；请先保存或打开多根工作区');
  }catch(err){vscode.window.showErrorMessage('关联执行仓库失败: '+err.message);}
 }
 async function checkExecutionRepo(){
  const target='https://github.com/'+EXECUTION_REPO+'/actions/workflows/issue-agent.yml';
  await vscode.env.openExternal(vscode.Uri.parse(target));
 }
 context.subscriptions.push(vscode.commands.registerCommand('dshWorkspace.setup',setup),vscode.commands.registerCommand('dshWorkspace.chat',chat),vscode.commands.registerCommand('dshWorkspace.status',status),vscode.commands.registerCommand('dshWorkspace.openDiscussion',openDiscussion),vscode.commands.registerCommand('dshWorkspace.runAgent',runAgent),vscode.commands.registerCommand('dshWorkspace.attachExecutionRepo',attachExecutionRepo),vscode.commands.registerCommand('dshWorkspace.checkExecutionRepo',checkExecutionRepo));
}
module.exports={activate,deactivate(){}};
