'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {load,save,example,ensureIgnore}=require('../src/project_profiles');
const profile={id:'test-p',name:'团队端点',baseURL:'https://api.example.com/v1',api:'openai-responses',models:['test-model'],apiKey:'SHOULD_NOT_LEAK'};
function temp(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-pr-'));try{fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('default project config excludes API key and template excludes key',()=>temp(dir=>{
 const file=save(dir,[profile]);example(dir,[profile]);
 assert.equal(load(dir).profiles[0].apiKey,undefined);
 assert.equal(fs.readFileSync(file,'utf8').includes('SHOULD_NOT_LEAK'),false);
 assert.equal(fs.readFileSync(path.join(dir,'.dsh','ai-profiles.example.json'),'utf8').includes('SHOULD_NOT_LEAK'),false);
}));
test('explicit opt in stores plaintext and protects by default via gitignore',()=>temp(dir=>{
 ensureIgnore(dir);
 const file=save(dir,[profile],{plaintext:true});
 assert.equal(load(dir).profiles[0].apiKey,'SHOULD_NOT_LEAK');
 assert.match(fs.readFileSync(path.join(dir,'.gitignore'),'utf8'),/\.dsh\/ai-profiles\.json/);
 ensureIgnore(dir);
 assert.equal(fs.readFileSync(path.join(dir,'.gitignore'),'utf8').match(/\.dsh\/ai-profiles\.json/g).length,1);
 if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o600);
}));

test('Git-tracked project config cannot be read or overwritten with a key',()=>temp(dir=>{
 const cp=require('node:child_process');
 cp.execFileSync('git',['init'],{cwd:dir,stdio:'ignore'});
 ensureIgnore(dir);
 save(dir,[profile],{plaintext:true});
 cp.execFileSync('git',['add','-f','.dsh/ai-profiles.json'],{cwd:dir,stdio:'ignore'});
 assert.throws(()=>load(dir),/已被 Git 跟踪/);
 assert.throws(()=>save(dir,[profile],{plaintext:true}),/已被 Git 跟踪/);
}));
