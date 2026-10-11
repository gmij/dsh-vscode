'use strict';
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
function parseGitHubRemote(remote) {
 const match=String(remote||'').trim().match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i);
 return match?match[1]:null;
}
function assertRepository(repo) {
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.includes('..')) throw new Error('仓库必须为 owner/repo');
 return repo;
}
async function run(bin,args,cwd) {
 const {stdout}=await execFileAsync(bin,args,{cwd,timeout:20000,maxBuffer:1048576,windowsHide:true});
 return stdout.trim();
}
async function verifyBinding({localPath,provider,repository},runCmd=run) {
 if(!localPath||typeof localPath!=='string') throw new Error('请选择本地目录');
 if(provider!=='github') throw new Error('当前仅支持 GitHub');
 assertRepository(repository);
 const origin=await runCmd('git',['remote','get-url','origin'],localPath);
 if(parseGitHubRemote(origin)?.toLowerCase()!==repository.toLowerCase()) throw new Error('本地 origin 与目标仓库不一致: '+origin);
 const info=JSON.parse(await runCmd('gh',['api','repos/'+repository,'--jq','{"full_name":.full_name,"default_branch":.default_branch}'],localPath));
 const issues=JSON.parse(await runCmd('gh',['api','repos/'+repository+'/issues?state=open&per_page=5','--jq','[.[] | select(.pull_request == null) | {number,title}]'],localPath));
 const milestones=JSON.parse(await runCmd('gh',['api','repos/'+repository+'/milestones?state=open&per_page=5','--jq','[.[] | {number,title}]'],localPath));
 return {repository:info.full_name,branch:info.default_branch,issues,milestones};
}
module.exports={parseGitHubRemote,assertRepository,verifyBinding,run};
