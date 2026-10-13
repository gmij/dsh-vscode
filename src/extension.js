'use strict';
const vscode=require('vscode');
const {verifyBinding,run,parseGitHubRemote}=require('./project');
const {ACPClient}=require('./acp');
const {Profiles,newId}=require('./profiles');
const projectProfiles=require('./project_profiles');
const KEY='dshWorkspace.project.v1';
const EXECUTION_REPO='gmij/dsh-actions-connectivity';
function activate(context) {
 const profiles=new Profiles(context);
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

 async function editProfile(existing){
  const name=await vscode.window.showInputBox({title:'AI 站点名称',value:existing?.name||'',prompt:'例如 我的 OpenAI 代理 / Claude 服务'});if(!name)return;
  const baseURL=await vscode.window.showInputBox({title:'API 端点（HTTPS）',value:existing?.baseURL||'https://api.openai.com/v1',prompt:'使用服务商文档给出的 Base URL'});if(!baseURL)return;
  const protocol=await vscode.window.showQuickPick(['openai-completions','openai-responses','anthropic-messages'].map(x=>({label:x})),{title:'该站点的 API 协议'});if(!protocol)return;
  const models=await vscode.window.showInputBox({title:'模型清单',value:existing?.models?.join(', ')||'',prompt:'逗号分隔，模型 ID 必须与端点实际支持的一致'});if(!models)return;
  const key=await vscode.window.showInputBox({title:'API Key（保存在 VS Code SecretStorage）',password:true,ignoreFocusOut:true,prompt:existing?'留空则保留原来的密钥':'请输入该站点 API Key'});
  if(key===undefined)return;
  try{
   const saved=await profiles.upsert({id:existing?.id||newId(),name,baseURL,api:protocol.label,models:models.split(',').map(x=>x.trim()).filter(Boolean)},key);
   vscode.window.showInformationMessage('AI 站点已保存：'+saved.name+'（密钥不会写入配置文件）');
  }catch(error){vscode.window.showErrorMessage('站点配置无效：'+error.message);}
 }
 async function exportProfiles(){
  const all=profiles.all();
  if(!all.length){vscode.window.showWarningMessage('尚无可导出的站点配置');return;}
  const dest=await vscode.window.showSaveDialog({saveLabel:'导出站点配置（不含密钥）',filters:{JSON:['json']},defaultUri:vscode.Uri.file('dsh-ai-profiles.json')});
  if(!dest)return;
  await vscode.workspace.fs.writeFile(dest,Buffer.from(JSON.stringify({schemaVersion:1,profiles:all},null,2),'utf8'));
  vscode.window.showInformationMessage('已导出站点、协议及模型清单，不包含 API Key。');
 }
 async function importProfiles(){
  const paths=await vscode.window.showOpenDialog({openLabel:'导入 AI 站点配置',canSelectMany:false,filters:{JSON:['json']}});
  if(!paths?.[0])return;
  try{
   const bytes=await vscode.workspace.fs.readFile(paths[0]);
   if(bytes.byteLength>131072)throw Error('配置文件过大');
   const data=JSON.parse(Buffer.from(bytes).toString('utf8'));
   if(data.schemaVersion!==1||!Array.isArray(data.profiles)||data.profiles.length>100)throw Error('配置文件格式不正确');
   const {validate}=require('./profiles');
   for(const original of data.profiles){
    const p=validate({...original,id:newId()});
    await profiles.upsert({id:p.id,name:p.name,baseURL:p.baseURL,api:p.api,models:p.models});
   }
   vscode.window.showInformationMessage('已导入 '+data.profiles.length+' 个站点，请在管理站点中分别设置 API Key。');
  }catch(error){vscode.window.showErrorMessage('导入失败：'+error.message);}
 }
 async function saveProjectProfiles(){
  const bound=project();
  if(!bound?.localPath){vscode.window.showWarningMessage('请先绑定当前项目');return;}
  const choices=profiles.all();
  if(!choices.length){vscode.window.showWarningMessage('请先添加 AI 站点');return;}
  const selected=await vscode.window.showQuickPick(choices.map(p=>({label:p.name,description:p.baseURL,profile:p})),{
    title:'选择要保存到当前项目的 AI 站点',canPickMany:true
  });
  if(!selected?.length)return;
  const setting=vscode.workspace.getConfiguration('dshWorkspace').get('allowPlaintextProjectKeys',false);
  if(setting){
    const ok=await vscode.window.showWarningMessage(
      '你已开启“在项目配置文件中明文保存 API Key”。项目成员或 Git 提交历史可能暴露这些密钥。仅用于可信项目；插件会默认加入 .gitignore，但已被跟踪的文件需要你手动停止跟踪。',
      {modal:true},'确认明文写入');
    if(ok!=='确认明文写入')return;
  }
  const records=[];
  for(const item of selected){
    const p={...item.profile};
    if(setting){
      const secret=await profiles.credentials(p.id);
      if(!secret){vscode.window.showErrorMessage(p.name+' 未配置 API Key，已取消导出');return;}
      p.apiKey=secret;
    }
    records.push(p);
  }
  try{
    // Protect even metadata-only file by default; user can explicitly version a keyless template.
    projectProfiles.ensureIgnore(bound.localPath);
    const file=projectProfiles.save(bound.localPath,records,{plaintext:setting});
    projectProfiles.example(bound.localPath,records);
    vscode.window.showInformationMessage('项目配置已保存：'+file+(setting?'（包含明文 API Key）':'（不含密钥）'));
  }catch(err){vscode.window.showErrorMessage('保存项目 AI 配置失败：'+err.message);}
 }
 async function importProjectProfiles(){
  const bound=project();if(!bound?.localPath){vscode.window.showWarningMessage('请先绑定当前项目');return;}
  try{
    const data=projectProfiles.load(bound.localPath);
    if(!data.profiles.length){vscode.window.showInformationMessage('当前项目没有 AI 配置文件或站点');return;}
    for(const original of data.profiles){
      const p={...original};delete p.apiKey;
      await profiles.upsert(p,original.apiKey||undefined);
    }
    vscode.window.showInformationMessage('已载入 '+data.profiles.length+' 个项目 AI 站点；存在明文 Key 的条目已迁入本机 SecretStorage。');
  }catch(err){vscode.window.showErrorMessage('读取项目 AI 配置失败：'+err.message);}
 }
 async function manageProfiles(){
  const items=[{label:'$(add) 添加 AI 站点',kind:'add'},{label:'$(folder) 保存站点到当前项目',kind:'project-save'},{label:'$(cloud-download) 从当前项目读取站点',kind:'project-load'},{label:'$(export) 导出站点配置 JSON（不含密钥）',kind:'export'},{label:'$(file-code) 导入站点配置 JSON',kind:'import'},...profiles.all().map(p=>({label:p.name,description:p.api+' · '+p.baseURL,kind:'edit',profile:p}))];
  const action=await vscode.window.showQuickPick(items,{title:'管理 AI 端点配置'});
  if(!action)return;
  if(action.kind==='add')return editProfile();
  if(action.kind==='project-save')return saveProjectProfiles();
  if(action.kind==='project-load')return importProjectProfiles();
  if(action.kind==='export')return exportProfiles();
  if(action.kind==='import')return importProfiles();
  const choice=await vscode.window.showQuickPick(['编辑站点 / 模型清单','更新 API Key','删除站点'].map(label=>({label})),{title:action.profile.name});
  if(!choice)return;
  if(choice.label.startsWith('编辑'))return editProfile(action.profile);
  if(choice.label.startsWith('更新')){
   const secret=await vscode.window.showInputBox({title:'更新 '+action.profile.name+' 的 API Key',password:true,ignoreFocusOut:true});
   if(secret)await profiles.upsert(action.profile,secret);
   return;
  }
  const confirm=await vscode.window.showWarningMessage('删除 '+action.profile.name+' 及其密钥？',{modal:true},'删除');
  if(confirm==='删除')await profiles.remove(action.profile.id);
 }
 async function selectProfile(){
  const all=profiles.all();
  if(!all.length){await editProfile();if(!profiles.all().length)return null;}
  const selected=await vscode.window.showQuickPick(profiles.all().flatMap(p=>p.models.map(model=>({
    label:model,description:p.name+' · '+p.api,profile:p,model
  }))),{title:'切换 AI 站点及模型'});
  if(!selected)return null;
  await profiles.select(selected.profile.id,selected.model);
  vscode.window.showInformationMessage('当前模型：'+selected.profile.name+' / '+selected.model);
  return selected;
 }
 async function chat() {
  const bound=project();
  if(!bound){vscode.window.showWarningMessage('请先执行 Setup Project');return;}
  const folder=bound.localPath;
  const fs=require('node:fs');
  if(!folder || !fs.existsSync(folder)){vscode.window.showErrorMessage('绑定的本地工作目录不存在');return;}
  const config=vscode.workspace.getConfiguration('dshWorkspace');
  const command=config.get('dshCommand','dsh');
  if(!profiles.selected()){const choice=await selectProfile();if(!choice)return;}
  let selected=profiles.selected();
  const provider=selected.profile.id;
  const model=selected.model;
  const output=vscode.window.createOutputChannel('DSH ACP Chat');
  output.show(true);
  output.appendLine('项目: '+bound.repository+'\\n工作目录: '+folder+'\\n采用真实 DSH ACP；工具权限默认拒绝。');
  let client;
  const launch=async()=>{
   const active=profiles.selected();
   if(!active)throw new Error('尚未选择有效的 AI 站点/模型');
   const apiKey=await profiles.credentials(active.profile.id);
   if(!apiKey)throw new Error('请先在管理站点中配置 '+active.profile.name+' 的 API Key');
   const running=new ACPClient(command,folder,{profile:active.profile,model:active.model,apiKey,
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
   await running.start();
   return running;
  };
  try{
   client=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'启动 DSH ACP'},launch);
   let key='dshWorkspace.session.v2:'+folder+':'+profiles.active().id+':'+profiles.active().model;
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
    const action=await vscode.window.showQuickPick([{label:'$(comment) 发送消息',kind:'message'},{label:'$(server) 切换站点 / 模型',kind:'switch'},{label:'$(gear) 管理站点配置',kind:'manage'},{label:'$(close) 结束聊天',kind:'exit'}],{title:'DSH ACP 对话 · '+profiles.selected().profile.name+' / '+profiles.selected().model});
    if(!action||action.kind==='exit')break;
    if(action.kind==='manage'){await manageProfiles();continue;}
    if(action.kind==='switch'){
      const previous=profiles.active();const switched=await selectProfile();
      if(!switched||previous.id===switched.profile.id&&previous.model===switched.model)continue;
      client.close();client=await launch();
      key='dshWorkspace.session.v2:'+folder+':'+switched.profile.id+':'+switched.model;
      saved=context.workspaceState.get(key);
      if(saved && saved.repository===bound.repository && saved.localPath===folder){
        await client.call('session/resume',{sessionId:saved.sessionId,cwd:folder,mcpServers:[]});
        output.appendLine('切换并恢复模型对应会话: '+saved.sessionId);
      }else{
        const next=await client.call('session/new',{cwd:folder,mcpServers:[]});
        if(!next?.sessionId)throw new Error('DSH 未返回 sessionId');
        saved={sessionId:next.sessionId,repository:bound.repository,localPath:folder};
        await context.workspaceState.update(key,saved);
        output.appendLine('切换并创建模型对应会话: '+saved.sessionId);
      }
      continue;
    }
    const message=await vscode.window.showInputBox({title:'DSH 对话 · '+profiles.selected().model,prompt:'输入消息（对话动作菜单可随时切换站点及模型）'});
    if(!message)continue;
    output.appendLine('\\n你: '+message);
    const result=await vscode.window.withProgress({location:vscode.ProgressLocation.Notification,title:'DSH 正在回复...'},()=>client.call('session/prompt',{sessionId:saved.sessionId,prompt:[{type:'text',text:message}]}));
    output.appendLine('本轮完成: '+JSON.stringify(result));
   }
  }catch(err){vscode.window.showErrorMessage('DSH ACP 聊天失败: '+err.message);output.appendLine('错误: '+err.stack);}
  finally{client?.close();}
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
 context.subscriptions.push(vscode.commands.registerCommand('dshWorkspace.setup',setup),vscode.commands.registerCommand('dshWorkspace.chat',chat),vscode.commands.registerCommand('dshWorkspace.manageProfiles',manageProfiles),vscode.commands.registerCommand('dshWorkspace.saveProjectProfiles',saveProjectProfiles),vscode.commands.registerCommand('dshWorkspace.importProjectProfiles',importProjectProfiles),vscode.commands.registerCommand('dshWorkspace.selectProfile',selectProfile),vscode.commands.registerCommand('dshWorkspace.status',status),vscode.commands.registerCommand('dshWorkspace.openDiscussion',openDiscussion),vscode.commands.registerCommand('dshWorkspace.runAgent',runAgent),vscode.commands.registerCommand('dshWorkspace.attachExecutionRepo',attachExecutionRepo),vscode.commands.registerCommand('dshWorkspace.checkExecutionRepo',checkExecutionRepo));
}
module.exports={activate,deactivate(){}};
