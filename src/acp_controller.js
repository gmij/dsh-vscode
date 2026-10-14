'use strict';
const {ACPClient}=require('./acp');
const projectProfiles=require('./project_profiles');
const {randomUUID,createHash}=require('node:crypto');
const {fault}=require('./ipc');

class WorkspaceACPController{
 constructor({workspace,profiles,workspaceState,dshCommand='dsh',Client=ACPClient,emit=()=>{}}){
  this.workspace=workspace;this.profiles=profiles;this.state=workspaceState;this.command=dshCommand;this.Client=Client;this.emit=emit;
  this.client=null;this.sessionId=null;this.active=null;this.busy=false;this.generation=0;this.workspaceKey=workspace?.localPath||'';this.sequence=0;this.streamId=randomUUID();this.turnId=null;this.unknown=false;this.connecting=false;this.owned=new Set();
 }
 send(event,payload={}){this.emit({version:1,event,streamId:this.streamId,sequence:++this.sequence,sessionId:this.sessionId,turnId:this.turnId,payload});}
 snapshot(){this.send('snapshot',this.status())}
 status(){return {connected:!!this.client&&!!this.sessionId,busy:this.busy,unknown:this.unknown,sessionId:this.sessionId,model:this.active?.model||'',profile:this.active?.profile.name||'',turnId:this.turnId};}
 async connect({resume=true}={}){
  if(this.connecting)throw fault('BUSY','正在连接');
  if(this.busy||this.unknown)throw fault('BUSY','请先断开当前请求或未知状态会话');
  this.connecting=true;
  const requestedGeneration=this.generation;
  try{
  if(!this.workspace?.localPath)throw Error('请先绑定 Git 工作区');
  let selected=this.profiles.selected();
  if(!selected)throw Error('请先选择 AI 站点及模型');
  // A project file can explicitly provide the key; SecretStorage remains a fallback.
  const data=projectProfiles.load(this.workspace.localPath);
  const fileProfile=data.profiles.find(p=>p.id===selected.profile.id);
  if(fileProfile){if(!fileProfile.models.includes(selected.model))throw fault('INVALID_PROFILE','当前模型已从项目配置中移除');selected={profile:fileProfile,model:selected.model};}
  const apiKey=fileProfile?.apiKey||await this.profiles.credentials(selected.profile.id);
  if(!apiKey)throw Error('当前 Provider 未配置 API Key');
  if(requestedGeneration!==this.generation)throw fault('CANCELLED','连接已取消');
  await this.disconnect();
  this.active=selected;
  const version=++this.generation;
  const client=new this.Client(this.command,this.workspace.localPath,{
   profile:selected.profile,model:selected.model,apiKey,
   onEvent:event=>{
    if(version!==this.generation)return;
    if(event.method==='process/exit'){
     this.unknown=true;this.clearPermissions();
     this.send('connectionLost',{unknown:this.unknown});return;
    }
    if(event.method!=='session/update'||!this.busy||this.unknown)return;
    const params=event.params||{};
    if(!this.sessionId||params.sessionId!==this.sessionId)return;
    const raw=params.update;
    if(!raw||typeof raw!=='object')return;
    const kind=raw.sessionUpdate;
    if(kind==='agent_message_chunk'&&raw.content?.type==='text'&&typeof raw.content.text==='string'){
     this.send('update',{update:{sessionUpdate:kind,content:{type:'text',text:raw.content.text.slice(0,65536)}}});
    }else if(['tool_call','tool_call_update'].includes(kind)&&typeof raw.toolCallId==='string'){
     this.send('tool',{toolCallId:raw.toolCallId.slice(0,256),title:this.redact(String(raw.title||'工具调用').slice(0,500)),status:['pending','in_progress','completed','failed'].includes(raw.status)?raw.status:'pending',
      text:this.redact((Array.isArray(raw.content)?raw.content:[]).filter(x=>x.type==='content'&&x.content?.type==='text').map(x=>x.content.text).join('\n').slice(0,8000))});
    }
   },
   onPermission:request=>this.requestPermission(request,version)
  });
  this.client=client;this.redact=value=>String(value).split(apiKey).join('[已隐藏]');
  try{
   await client.start();
   if(version!==this.generation)throw fault('CANCELLED','连接已取消');
   const storeKey=this.key(selected);
   const saved=this.state.get(storeKey);
   let result;
   this.owned=new Set(this.state.get(storeKey+':owned',[]));
   if(resume&&saved?.repository===this.workspace.repository&&saved?.sessionId){
    result=await client.call('session/resume',{sessionId:saved.sessionId,cwd:this.workspace.localPath,mcpServers:[]});
    if(version!==this.generation)throw fault('CANCELLED','连接已取消');
    this.sessionId=saved.sessionId;
   }else{
    result=await client.call('session/new',{cwd:this.workspace.localPath,mcpServers:[]});
    if(version!==this.generation)throw fault('CANCELLED','连接已取消');
    if(typeof result?.sessionId!=='string'||!result.sessionId)throw Error('DSH 未返回有效 sessionId');
    this.sessionId=result.sessionId;
    await this.state.update(storeKey,{repository:this.workspace.repository,sessionId:this.sessionId});
   }
   this.owned.add(this.sessionId);
   await this.state.update(storeKey+':owned',[...this.owned]);
   if(version!==this.generation)throw fault('CANCELLED','连接已取消');
   this.send('connected',{sessionId:this.sessionId,profile:selected.profile.name,model:selected.model});
   return {sessionId:this.sessionId};
  }catch(err){if(version===this.generation)await this.disconnect();throw err}
  }finally{this.connecting=false}
 }
 key(selected){const p=selected.profile;return 'dshWorkspace.session.v3:'+createHash('sha256').update(JSON.stringify([require('node:fs').realpathSync(this.workspace.localPath),this.workspace.repository,p.id,p.baseURL,p.api,selected.model])).digest('hex')}
 async cancel(){
  if(!this.client||!this.sessionId||!this.busy)return false;
  // ACP session/cancel is a notification: do not await an invented reply.
  this.clearPermissions();
  this.client.send({jsonrpc:'2.0',method:'session/cancel',params:{sessionId:this.sessionId}});
  this.send('cancelling');
  return true;
 }
 async listSessions(){
  if(!this.client)throw Error('尚未连接');
  if(this.busy||this.unknown||this.connecting)throw fault('BUSY','当前会话尚未稳定');
  const version=this.generation;
  const result=await this.client.call('session/list',{cwd:this.workspace.localPath,mcpServers:[]});
  if(version!==this.generation)throw fault('CANCELLED','会话列表请求已取消');
  return {sessions:(Array.isArray(result?.sessions)?result.sessions:[]).filter(s=>this.owned.has(s.sessionId)).map(s=>({sessionId:s.sessionId,title:this.redact?this.redact(String(s.title||s.sessionId)).slice(0,200):s.sessionId}))};
 }
 async resume(sessionId){
  if(this.busy||this.unknown)throw fault('BUSY','当前请求尚未完成或状态未知');
  if(!this.owned.has(sessionId))throw fault('SESSION_SCOPE','该会话不属于当前项目、站点与模型');
  if(!this.client||typeof sessionId!=='string'||!sessionId)throw Error('请先连接并选择会话');
  this.busy=true;const version=this.generation;const active=this.active;
  try{
   const result=await this.client.call('session/resume',{sessionId,cwd:this.workspace.localPath,mcpServers:[]});
   if(version!==this.generation)throw fault('CANCELLED','会话恢复已取消');
   this.sessionId=sessionId;
   await this.state.update(this.key(active),{repository:this.workspace.repository,sessionId});
   if(version!==this.generation)throw fault('CANCELLED','会话恢复已取消');
   this.send('connected',{sessionId,profile:active.profile.name,model:active.model});return {};
  }finally{if(version===this.generation)this.busy=false}

 }
 async prompt(text){
  if(!this.client||!this.sessionId)throw Error('尚未连接');
  if(this.busy||this.unknown||this.connecting)throw fault('BUSY','上一轮请求尚未结束或结果未知');
  if(typeof text!=='string'||!text.trim()||text.length>16000)throw Error('消息必须为 1-16000 个字符');
  this.busy=true;this.turnId=randomUUID();
  const version=this.generation;const client=this.client;
  this.send('turnStart',{text});
  try{
   const result=await client.call('session/prompt',{sessionId:this.sessionId,prompt:[{type:'text',text}]});
   if(version!==this.generation)return {};
   this.clearPermissions();
   this.send('turnComplete',{result:result&&typeof result==='object'?{stopReason:result.stopReason||'completed'}:{}});
   return result;
  }catch(err){
   if(version===this.generation){this.unknown=true;this.clearPermissions();this.send('turnError',{message:'请求结果未知，请断开后确认会话状态；不会自动重发',unknown:true});}
   throw fault('UNKNOWN_RESULT','请求结果未知');
  }finally{if(version===this.generation){this.busy=false;this.turnId=null}}
 }
 requestPermission(request,version){
  return new Promise(resolve=>{
   if(version!==this.generation||this.unknown||!this.busy||!this.sessionId||request?.sessionId!==this.sessionId){resolve(null);return}
   const options=Array.isArray(request?.options)?request.options.filter(o=>typeof o.optionId==='string'&&o.optionId.length<=256&&o.kind!=='allow_always').slice(0,16).map(o=>({optionId:o.optionId,name:this.redact?this.redact(String(o.name||o.optionId)).slice(0,80):String(o.name||o.optionId).slice(0,80)})):[];
   if(!options.length){resolve(null);return}
   const id=require('node:crypto').randomUUID();
   const timer=setTimeout(()=>{this.permissions?.delete(id);resolve(null);this.send('permissionExpired',{id})},60000);
   this.permissions??=new Map();
   this.permissions.set(id,{options,resolve,timer});
   this.send('permission',{id,summary:this.redact?this.redact(String(request.toolCall?.title||'工具请求').slice(0,500)):'工具请求',options});
  });
 }
 decide(id,optionId){
  const pending=this.permissions?.get(id);
  if(!pending)return false;
  this.permissions.delete(id);clearTimeout(pending.timer);
  pending.resolve(pending.options.some(o=>o.optionId===optionId)?optionId:null);
  return true;
 }
 clearPermissions(){if(this.permissions){for(const [id,p] of this.permissions){clearTimeout(p.timer);p.resolve(null);this.send('permissionExpired',{id})}this.permissions.clear()}}
 async disconnect(){
  this.generation++;
  this.clearPermissions();
  this.client?.close();this.client=null;this.sessionId=null;this.busy=false;this.active=null;this.unknown=false;this.turnId=null;
  this.send('disconnected');
 }
 dispose(){void this.disconnect()}
}
module.exports={WorkspaceACPController};
