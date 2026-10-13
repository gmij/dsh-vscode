'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=fs.readFileSync('scripts/issue_evidence_gate.py','utf8');
test('evidence gate never silently closes an Issue or checks a box',()=>{
 assert.ok(file.includes('dsh-evidence-gate:run-'));
 assert.ok(file.includes('def outstanding(body):'));
 assert.ok(file.includes('def comment(issue,run_id,record,body'));
 assert.ok(!file.includes("'/issues/{number}'") || !file.includes('method="PATCH"'));
 assert.ok(!file.includes("'state':'closed'"));
});
