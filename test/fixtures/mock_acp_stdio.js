'use strict';
const readline=require('node:readline');
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
const send=msg=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...msg})+'\n');
let pendingPrompt=null;
rl.on('line',line=>{
 let msg;try{msg=JSON.parse(line)}catch{return}
 if(msg.method==='initialize')send({id:msg.id,result:{protocolVersion:1,agentCapabilities:{}}});
 else if(msg.method==='session/new')send({id:msg.id,result:{sessionId:'fixture-session'}});
 else if(msg.method==='session/list')send({id:msg.id,result:{sessions:[{sessionId:'fixture-session',cwd:process.cwd()}]}});
 else if(msg.method==='session/resume')send({id:msg.id,result:{sessionId:msg.params.sessionId}});
 else if(msg.method==='session/prompt'){
  pendingPrompt=msg.id;
  send({method:'session/update',params:{sessionId:'fixture-session',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'ACP integration ok'}}}});
  send({id:901,method:'session/request_permission',params:{sessionId:'fixture-session',toolCall:{title:'read README'},options:[{optionId:'allow-once',name:'Allow once'}]}});
 }
 else if(msg.id===901 && msg.result){
  send({id:pendingPrompt,result:{stopReason:'end_turn'}});
  pendingPrompt=null;
 }
 else if(msg.method==='session/cancel'){
  send({method:'session/update',params:{sessionId:'fixture-session',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'cancelled'}}}});
 }
});
