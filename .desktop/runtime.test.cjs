const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net');
const {validateProject,isEditorURL,externalURL,freePort,readSettings,writeSettings,startService}=require('./runtime.cjs');
const root=path.resolve(__dirname,'..');
test('project picker validates roots and navigation only accepts exact loopback origin',async()=>{
 assert.equal(await validateProject(root),root);await assert.rejects(validateProject(path.dirname(root)));await assert.rejects(validateProject('../floorball-training'));
 const origin='http://127.0.0.1:5180';assert.ok(isEditorURL(origin+'/app.js',origin));for(const url of ['http://127.0.0.1:5181/','http://127.0.0.1.evil/','file:///D:/x','http://name@127.0.0.1:5180/'])assert.equal(isEditorURL(url,origin),false);
 for(const url of ['javascript:alert(1)','file:///D:/x','https://name:pass@example.com'])assert.equal(externalURL(url),null);assert.equal(externalURL('https://example.com/'),'https://example.com/');
});
test('settings retain per-project ports and an occupied port is skipped',async()=>{
 const dir=path.join(root,'.vitepress/cache/content-editor','desktop-unit-'+Date.now());await fs.mkdir(dir,{recursive:true});const file=path.join(dir,'settings.json');assert.deepEqual(await readSettings(file),{projects:{}});const value={project:root,projects:{[root]:{port:5180,previewPort:5181}}};await writeSettings(file,value);assert.deepEqual(await readSettings(file),value);
 const occupied=net.createServer();await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));try{const port=occupied.address().port;assert.notEqual(await freePort(port),port);}finally{await new Promise(resolve=>occupied.close(resolve));}
});
test('desktop-owned backend starts, uses its own port and shuts down without stopping external editor',async()=>{
 const port=await freePort(5240),previewPort=await freePort(port+1);const service=await startService({root,node:process.execPath,port,previewPort});
 try{const info=await fetch(service.origin+'/api/session').then(r=>r.json());assert.equal(info.root,root);assert.equal(info.version,1);assert.ok(service.child.pid);}finally{await service.stop();}
 await assert.rejects(fetch(service.origin+'/api/session',{signal:AbortSignal.timeout(500)}));
});
