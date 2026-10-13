'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');

test('safe checkpoint recovery provenance and level checks',()=>{
 const result=spawnSync('python',['-c',String.raw`
import tempfile,json,pathlib
from scripts.recover_design_checkpoints import validate_origin,restore
repo='gmij/dsh-vscode'
run={'repository':{'full_name':repo},'path':'.github/workflows/dsh-issue-agent.yml',
'event':'issues','status':'completed','head_branch':'main','display_title':'DSH Issue #11'}
validate_origin(run,repo,11)
try: validate_origin(run,repo,1)
except ValueError: pass
else: raise AssertionError('cross issue replay must fail')
with tempfile.TemporaryDirectory() as root:
 p=pathlib.Path(root);source=p/'source';source.mkdir()
 (source/'stage-core.json').write_text(json.dumps({'level':'overview','schema_version':2}))
 (source/'stage-channel-IPC-01.json').write_text(json.dumps({'channel':{'id':'IPC-01'}}))
 (source/'unrelated.json').write_text('{}')
 copied=restore(source,p/'target','overview')
 assert len(copied)==2
 assert not (p/'target/unrelated.json').exists()
 try: restore(source,p/'no','detailed')
 except ValueError: pass
 else: raise AssertionError('cross level replay must fail')
`]);
 assert.equal(result.status,0,result.stderr?.toString());
});
