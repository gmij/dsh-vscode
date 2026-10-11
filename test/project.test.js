'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseGitHubRemote,assertRepository,verifyBinding}=require('../src/project');
test('git remote formats',()=>{
 assert.equal(parseGitHubRemote('https://github.com/gmij/foo.git'),'gmij/foo');
 assert.equal(parseGitHubRemote('git@github.com:gmij/foo.git'),'gmij/foo');
 assert.equal(parseGitHubRemote('https://gitlab.com/gmij/foo.git'),null);
});
test('repository validation',()=>{
 assert.equal(assertRepository('gmij/foo'),'gmij/foo');
 assert.throws(()=>assertRepository('x;rm'));
});
test('binding verifies origin and remote reads',async()=>{
 const calls=[];
 const mock=async(bin,args)=>{calls.push([bin,args]);if(bin==='git')return 'git@github.com:gmij/foo.git';if(args[1]==='repos/gmij/foo')return '{"full_name":"gmij/foo","default_branch":"main"}';return '[]';};
 const value=await verifyBinding({localPath:'/tmp/foo',provider:'github',repository:'gmij/foo'},mock);
 assert.equal(value.branch,'main');assert.equal(calls.length,4);
});
test('remote mismatch rejects',async()=>{
 await assert.rejects(()=>verifyBinding({localPath:'/tmp/foo',provider:'github',repository:'gmij/foo'},async()=>'https://github.com/other/foo.git'),/不一致/);
});
