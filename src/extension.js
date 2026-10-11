'use strict';
const vscode=require('vscode');
const {verifyBinding,run,parseGitHubRemote}=require('./project');
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
 context.subscriptions.push(vscode.commands.registerCommand('dshWorkspace.setup',setup),vscode.commands.registerCommand('dshWorkspace.status',status),vscode.commands.registerCommand('dshWorkspace.openDiscussion',openDiscussion),vscode.commands.registerCommand('dshWorkspace.runAgent',runAgent));
}
module.exports={activate,deactivate(){}};
