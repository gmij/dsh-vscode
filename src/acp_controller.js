'use strict';
const {ACPClient}=require('./acp');
const projectProfiles=require('./project_profiles');

class WorkspaceACPController{
 constructor({workspace,profiles,workspaceState,dshCommand='dsh',Client=ACPClient,emit=()=>{}}){
  this.workspace=workspace;this.profiles=profiles;this.state=workspaceState;this.command=dshCommand;this.Client=Client;this.emit=emit;
  this.client=null;this.sessionId=null;this.active=null;this.busy=false;this.generation=0;this.workspaceKey=workspace?.localPath||'';
 }
 send(type,payload={}){this.emit({type,payload});}
 async connect(){
  if(this.busy)throw Error('当前有请求进行中');
  if(this.client && this.sessionId)await this.disconnect();
  if(!this.workspace?.localPath)throw Error('请先绑定 Git 工作区');
  const selected=this.profiles.selected();
  if(!selected)throw Error('请先选择 AI 站点及模型');
  // A project file can explicitly provide the key; SecretStorage remains a fallback.
  const data=projectProfiles.load(this.workspace.localPath);
  const fileProfile=data.profiles.find(p=>p.id===selected.profile.id);
  const apiKey=fileProfile?.apiKey||await this.profiles.credentials(selected.profile.id);
  if(!apiKey)throw Error('当前 Provider 未配置 API Key');
  await this.disconnect();
  this.active=selected;
  const version=++this.generation;
  const client=new this.Client(this.command,this.workspace.localPath,{
   profile:selected.profile,model:selected.model,apiKey,
   onEvent:event=>{if(version===this.generation&&event.method==='session/update')this.send('update',event.params)},
   onPermission:request=>this.requestPermission(request,version)
  });
  this.client=client;
  try{
   await client.start();
   const storeKey=this.key(selected);
   const saved=this.state.get(storeKey);
   let result;
   if(saved?.repository===this.workspace.repository&&saved?.sessionId){
    result=await client.call('session/resume',{sessionId:saved.sessionId,cwd:this.workspace.localPath,mcpServers:[]});
    this.sessionId=saved.sessionId;
   }else{
    result=await client.call('session/new',{cwd:this.workspace.localPath,mcpServers:[]});
    if(typeof result?.sessionId!=='string'||!result.sessionId)throw Error('DSH 未返回有效 sessionId');
    this.sessionId=result.sessionId;
    await this.state.update(storeKey,{repository:this.workspace.repository,sessionId:this.sessionId});
   }
   this.send('connected',{sessionId:this.sessionId,profile:selected.profile.name,model:selected.model});
   return {sessionId:this.sessionId};
  }catch(err){await this.disconnect();throw err}
 }
 key(selected){return 'dshWorkspace.session.v2:'+this.workspace.localPath+':'+selected.profile.id+':'+selected.model}
 async prompt(text){
  if(!this.client||!this.sessionId)throw Error('尚未连接');
  if(this.busy)throw Error('上一轮请求尚未结束');
  if(typeof text!=='string'||!text.trim()||text.length>16000)throw Error('消息必须为 1-16000 个字符');
  this.busy=true;
  this.send('turnStart',{text});
  try{
   const result=await this.client.call('session/prompt',{sessionId:this.sessionId,prompt:[{type:'text',text}]});
   this.send('turnComplete',{result:result&&typeof result==='object'?{stopReason:result.stopReason||'completed'}:{}});
   return result;
  }catch(err){this.send('turnError',{message:err.message});throw err}
  finally{this.busy=false}
 }
 requestPermission(request,version){
  return new Promise(resolve=>{
   if(version!==this.generation){resolve(null);return}
   const options=Array.isArray(request?.options)?request.options.filter(o=>typeof o.optionId==='string').map(o=>({optionId:o.optionId,name:String(o.name||o.optionId).slice(0,80)})):[];
   if(!options.length){resolve(null);return}
   const id=require('node:crypto').randomUUID();
   const timer=setTimeout(()=>{this.permissions?.delete(id);resolve(null);this.send('permissionExpired',{id})},60000);
   this.permissions??=new Map();
   this.permissions.set(id,{options,resolve,timer});
   this.send('permission',{id,summary:JSON.stringify(request.toolCall||{}).slice(0,500),options});
  });
 }
 decide(id,optionId){
  const pending=this.permissions?.get(id);
  if(!pending)return false;
  this.permissions.delete(id);clearTimeout(pending.timer);
  pending.resolve(pending.options.some(o=>o.optionId===optionId)?optionId:null);
  return true;
 }
 async disconnect(){
  this.generation++;
  if(this.permissions){for(const [id,p] of this.permissions){clearTimeout(p.timer);p.resolve(null)}this.permissions.clear()}
  this.client?.close();this.client=null;this.sessionId=null;this.busy=false;this.active=null;
  this.send('disconnected');
 }
 dispose(){void this.disconnect()}
}
module.exports={WorkspaceACPController};
