'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createPatch}=require('./profiles');

class ACPClient {
  constructor(command, cwd, options = {}) {
    this.cwd = cwd;
    this.seq = 0;
    this.pending = new Map();
    this.buffer = '';
    this.onUpdate = options.onUpdate || (() => {});
    this.onEvent = options.onEvent || (() => {});
    this.onPermission = options.onPermission || (async () => null);
    this.process = null;
    this.closed = false;
    this.command = command;
    this.provider = options.provider || '';
    this.model = options.model || '';
    this.patchPath = null;
    this.profile = options.profile || null;
    this.apiKey = options.apiKey || null;
  }
  async start() {
    let args = ['--profile', 'acp'];
    if (this.profile || (this.provider && this.model)) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-vscode-'));
      this.patchPath = path.join(dir, 'acp.json');
      const patch=this.profile?createPatch(this.profile,this.model):[{id:'acp',config:{provider:this.provider,model:this.model}}];
      fs.writeFileSync(this.patchPath, JSON.stringify(patch), {mode: 0o600});
      args = args.concat(['--patch', this.patchPath]);
    }
    this.process = cp.spawn(this.command, args, {cwd: this.cwd, env: this.apiKey ? {...process.env,DSH_WORKSPACE_API_KEY:this.apiKey}:process.env,
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false});
    this.process.stdout.setEncoding('utf8');
    this.process.stdout.on('data', value => this.receive(value));
    this.process.stderr.setEncoding('utf8');
    this.process.stderr.on('data', value => { this.onEvent({method:'stderr',params:{message:'DSH diagnostic output'}}); });
    this.process.on('error', err => this.rejectPending(err));
    this.process.on('exit', (code) => {
      this.rejectPending(new Error('DSH ACP process exited: ' + code));
    });
    return this.call('initialize', {protocolVersion: 1, clientCapabilities: {},
      clientInfo: {name: 'dsh-vscode', version: '0.2.0'}});
  }
  receive(data) {
    this.buffer += data;
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (_) { continue; }
      if (msg.id !== undefined && !msg.method) {
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          clearTimeout(pending.timer);
          if (msg.error) pending.reject(new Error(msg.error.message || 'ACP request failed'));
          else pending.resolve(msg.result);
        }
      } else if (msg.method === 'session/request_permission' && msg.id !== undefined) {
        // Ask the host UI; default to rejection on dismiss, error or unknown choice.
        Promise.resolve().then(() => this.onPermission(msg.params || {}))
          .then(optionId => {
            const options = msg.params?.options || [];
            const valid = options.some(option => option.optionId === optionId);
            const outcome = valid ? {outcome: 'selected', optionId} : {outcome: 'cancelled'};
            this.send({jsonrpc: '2.0', id: msg.id, result: {outcome}});
          })
          .catch(() => {
            try { this.send({jsonrpc: '2.0', id: msg.id,
              result: {outcome: {outcome: 'cancelled'}}}); } catch (_) {}
          });
      } else if (msg.method === 'session/update') {
        const update = msg.params?.update;
        this.onEvent({method:'session/update',params:msg.params||{}});
        this.onUpdate(JSON.stringify(update || {}, null, 2).slice(0, 10000));
      }
    }
  }
  send(value) {
    if (!this.process || this.process.stdin.destroyed) throw new Error('ACP process unavailable');
    this.process.stdin.write(JSON.stringify(value) + '\n');
  }
  call(method, params, timeout = 180000) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('ACP timed out: ' + method));
      }, timeout);
      this.pending.set(id, {resolve, reject, timer});
      try { this.send({jsonrpc: '2.0', id, method, params}); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  rejectPending(error) {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
      this.pending.delete(id);
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.process && !this.process.killed) this.process.kill();
    if (this.patchPath) {
      try { fs.unlinkSync(this.patchPath); fs.rmdirSync(path.dirname(this.patchPath)); } catch (_) {}
    }
  }
}
module.exports = {ACPClient};
