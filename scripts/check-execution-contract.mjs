import assert from 'node:assert/strict';
const base='https://raw.githubusercontent.com/gmij/dsh-actions-connectivity/main/.github/workflows';
const expected={
 'run-agent.yml':['workflow_dispatch:','agent:','task:','model:','@deepseek-ai/dsh'],
 'issue-agent.yml':['workflow_dispatch:','issue_number:','python scripts/issue_agent.py']
};
for(const [file,terms] of Object.entries(expected)){
 const res=await fetch(base+'/'+file);
 assert.equal(res.status,200,file+' unavailable: '+res.status);
 const content=await res.text();
 for(const term of terms)assert.ok(content.includes(term),file+' missing '+term);
 console.log(file+': contract OK');
}
