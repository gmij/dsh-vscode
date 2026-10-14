'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
test('workspace setup webview is registered and loaded through trusted extension host',()=>{
 const pkg=require('../package.json');
 assert(pkg.contributes.commands.some(c=>c.command==='dshWorkspace.openSettings'));
 const extension=fs.readFileSync(path.join(root,'src/extension.js'),'utf8');
 assert.match(extension,/registerCommand\('dshWorkspace\.openSettings'/);
 assert.match(extension,/openWorkspacePanel\(context/);
});
test('workspace setup webview provides stable no-key UI and strict command whitelist',()=>{
 const panel=fs.readFileSync(path.join(root,'src/workspace_panel.js'),'utf8');
 assert.match(panel,/default-src 'none'/);
 assert.match(panel,/script-src 'nonce-/);
 assert.match(panel,/textContent=/);
 assert.match(panel,/allowed=\{/);
 assert.match(panel,/setup:'dshWorkspace\.setup'/);
 assert.match(panel,/manageProfiles:'dshWorkspace\.manageProfiles'/);
 assert.match(panel,/chat:'dshWorkspace\.chat'/);
 assert(!panel.includes('innerHTML='));
 assert(!panel.includes('apiKey'));
});
