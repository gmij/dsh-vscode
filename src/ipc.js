'use strict';
const {randomUUID}=require('node:crypto');
const fields={connect:['resume'],prompt:['text'],cancel:[],listSessions:[],resume:['sessionId'],selectProfile:[],status:[],setupProject:[],manageProfiles:[],disconnect:[],settings:[],permissionRespond:['ticketId','optionId']};
function fault(code,message){return Object.assign(new Error(message),{code,publicMessage:message})}
function validate(message){
 if(!message||typeof message!=='object'||Array.isArray(message)||JSON.stringify(message).length>20000)throw fault('INVALID_REQUEST','消息格式或大小不正确');
 if(Object.keys(message).some(k=>!['version','requestId','type','payload'].includes(k))||message.version!==1||typeof message.requestId!=='string'||!/^[\w-]{1,80}$/.test(message.requestId)||!Object.hasOwn(fields,message.type))throw fault('INVALID_REQUEST','不支持的 IPC 信封');
 const p=message.payload;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!fields[message.type].includes(k)))throw fault('INVALID_REQUEST','不支持的消息字段');
 if(message.type==='prompt'&&(typeof p.text!=='string'||!p.text.trim()||p.text.length>16000))throw fault('INVALID_REQUEST','消息必须为 1-16000 个字符');
 if(message.type==='connect'&&p.resume!==undefined&&typeof p.resume!=='boolean')throw fault('INVALID_REQUEST','resume 必须为布尔值');
 if(message.type==='resume'&&(typeof p.sessionId!=='string'||!p.sessionId||p.sessionId.length>256))throw fault('INVALID_REQUEST','会话 ID 不正确');
 if(message.type==='permissionRespond'&&(typeof p.ticketId!=='string'||p.ticketId.length>80||!(p.optionId===null||typeof p.optionId==='string'&&p.optionId.length<=256)))throw fault('INVALID_REQUEST','权限裁决不正确');
 return message;
}
class IPCRouter{
 constructor({dispatch,post}){this.dispatch=dispatch;this.post=post;this.requests=new Set();this.id=randomUUID()}
 async receive(message){
  let m;
  try{m=validate(message)}catch(err){this.post({version:1,requestId:typeof message?.requestId==='string'?message.requestId.slice(0,80):'',ok:false,error:{code:'INVALID_REQUEST',message:err.message}});return}
  if(this.requests.has(m.requestId)){this.post({version:1,requestId:m.requestId,ok:false,error:{code:'DUPLICATE_REQUEST',message:'该请求已提交，不会重复执行'}});return}
  // Retain IDs for the complete Webview lifetime; fail closed rather than evicting replay protection.
  if(this.requests.size>=10000){this.post({version:1,requestId:m.requestId,ok:false,error:{code:'LIMIT_REACHED',message:'请重新打开侧栏以建立新的 IPC 通道'}});return}
  this.requests.add(m.requestId);
  try{const data=await this.dispatch(m.type,m.payload);this.post({version:1,requestId:m.requestId,ok:true,data:data&&typeof data==='object'?data:{}})}
  catch(err){this.post({version:1,requestId:m.requestId,ok:false,error:{code:err.code||'OPERATION_FAILED',message:err.publicMessage||'操作失败，请检查连接、配置和当前会话状态'}})}
 }
}
module.exports={IPCRouter,validate,fault};
