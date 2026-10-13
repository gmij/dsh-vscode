'use strict';
const crypto=require('node:crypto');
const KEY='dshWorkspace.aiProfiles.v1';
const ACTIVE='dshWorkspace.activeProfile.v1';
const protocols=new Set(['openai-completions','openai-responses','anthropic-messages']);
function validate(p){
 if(!p||typeof p!=='object'||!p.id||typeof p.name!=='string'||!p.name.trim())throw Error('站点名称不能为空');
 if(!/^https:\/\/[^\s/?#]+(?::\d+)?(?:\/[^\s?#]*)?$/.test(p.baseURL||''))throw Error('端点必须是 HTTPS URL（可包含路径）');
 const u=new URL(p.baseURL);if(u.username||u.password||u.hash||u.search)throw Error('端点不允许账号、密码、查询参数');
 if(!protocols.has(p.api))throw Error('不支持的 API 协议');
 if(!Array.isArray(p.models)||!p.models.length||p.models.some(m=>typeof m!=='string'||!m.trim()))throw Error('至少配置一个模型 ID');
 return {...p,models:[...new Set(p.models.map(x=>x.trim()))]};
}
class Profiles{
 constructor(context){this.state=context.globalState;this.secrets=context.secrets;}
 all(){return this.state.get(KEY,[]);}
 active(){return this.state.get(ACTIVE,null);}
 async upsert(profile,key){
  const p=validate(profile);
  const current=this.all().filter(x=>x.id!==p.id);current.push(p);
  if(key!==undefined&&key!==null&&key!=='')await this.secrets.store('dshWorkspace.secret.'+p.id,key);
  await this.state.update(KEY,current);
  if(!this.active())await this.state.update(ACTIVE,{id:p.id,model:p.models[0]});
  return p;
 }
 async select(id,model){const p=this.all().find(x=>x.id===id);if(!p||!p.models.includes(model))throw Error('站点/模型不存在');await this.state.update(ACTIVE,{id,model});}
 async credentials(id){return this.secrets.get('dshWorkspace.secret.'+id);}
 async remove(id){await this.secrets.delete('dshWorkspace.secret.'+id);await this.state.update(KEY,this.all().filter(p=>p.id!==id));if(this.active()?.id===id)await this.state.update(ACTIVE,null);}
 selected(){const active=this.active();const profile=this.all().find(p=>p.id===active?.id);return profile&&profile.models.includes(active.model)?{profile,model:active.model}:null;}
}
function createPatch(profile,model){
 const p=validate(profile);if(!p.models.includes(model))throw Error('所选模型不在站点清单');
 // Env name is unique per spawned child, never persisted into shared DSH config.
 return [
  {id:'acp',config:{provider:p.id,model}},
  {id:'agent-default-model',config:{provider:p.id,model}},
  {id:'llm-pi-ai',config:{providers:{[p.id]:{
    api:p.api,apiKeyEnv:'DSH_WORKSPACE_API_KEY',baseURL:p.baseURL,
    models:[{id:model}],retryPolicy:{mode:'normal',maxRetries:0}
  }}}}
 ];
}
function newId(){return 'workspace-'+crypto.randomUUID().replace(/-/g,'').slice(0,16);}
module.exports={Profiles,createPatch,validate,newId};
