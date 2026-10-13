'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {validate}=require('./profiles');
const RELATIVE=path.join('.dsh','ai-profiles.json');
function location(root){if(!root||!path.isAbsolute(root))throw Error('项目目录必须是绝对路径');return path.join(root,RELATIVE);}
function load(root){
 const file=location(root);
 if(!fs.existsSync(file))return {schemaVersion:1,profiles:[]};
 const raw=fs.readFileSync(file,'utf8');
 if(raw.length>262144)throw Error('配置文件过大');
 const value=JSON.parse(raw);
 if(value.schemaVersion!==1||!Array.isArray(value.profiles)||value.profiles.length>100)throw Error('项目 AI 配置格式不正确');
 return {schemaVersion:1,profiles:value.profiles.map(x=>({...validate(x),apiKey:typeof x.apiKey==='string'?x.apiKey:undefined}))};
}
function save(root, profiles,{plaintext=false}={}){
 if(!Array.isArray(profiles)||profiles.length>100)throw Error('配置过多');
 const clean=profiles.map(item=>{
  const p=validate(item);
  const result={id:p.id,name:p.name,baseURL:p.baseURL,api:p.api,models:p.models};
  if(plaintext&&typeof item.apiKey==='string'&&item.apiKey)result.apiKey=item.apiKey;
  return result;
 });
 const dest=location(root);fs.mkdirSync(path.dirname(dest),{recursive:true});
 // Atomic write; files containing secrets are owner-readable on POSIX.
 const temp=dest+'.tmp-'+process.pid;
 try{
  fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,profiles:clean},null,2)+'\n',{mode:0o600,flag:'wx'});
  fs.renameSync(temp,dest);try{fs.chmodSync(dest,0o600);}catch(_){}
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 return dest;
}
function example(root,profiles){
 const dest=path.join(root,'.dsh','ai-profiles.example.json');
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.writeFileSync(dest,JSON.stringify({schemaVersion:1,profiles:profiles.map(({id,name,baseURL,api,models})=>({id,name,baseURL,api,models}))},null,2)+'\n');
 return dest;
}
function ensureIgnore(root){
 const file=path.join(root,'.gitignore'),entry='.dsh/ai-profiles.json';
 const original=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
 if(original.split(/\r?\n/).some(line=>line.trim()===entry))return;
 fs.appendFileSync(file,(original&&!original.endsWith('\n')?'\n':'')+entry+'\n');
}
module.exports={location,load,save,example,ensureIgnore};
