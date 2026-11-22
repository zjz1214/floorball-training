const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {createHash}=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const exec=promisify(execFile);

async function git(root,args,{limit=4*1024*1024,ok=[0]}={}){
  try{
    const {stdout}=await exec('git',['--literal-pathspecs','-c','core.quotepath=false',...args],{
      cwd:root,windowsHide:true,maxBuffer:limit,timeout:120000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}
    });
    return stdout;
  }catch(error){
    if(ok.includes(error.code))return error.stdout;
    if(error.code==='ENOENT')throw Error('找不到 Git。请先安装 Git for Windows，再重新打开编辑器。');
    if(error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER')throw error;
    throw Error(error.stderr?.trim().slice(0,1600)||'Git 操作未完成，请检查本地仓库或登录状态。');
  }
}

const contentFolders=new Set(['软曲简介','个人技术基础','个人技术进阶','专项练习','团队训练','校队训练记录','训练计划','装备器材','比赛经验','发力原理解析','热身及小游戏','其他']);
function filePolicy(name){
  if(/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.git(?:\/|$)|\.github|\.ssh|\.npmrc|\.netrc|\.git-credentials)(?:\/|$)|\.(?:pem|key|pfx|p12)$/i.test(name))return 'blocked';
  if(name==='index.md'||contentFolders.has(name.split('/')[0])&&name.endsWith('.md')||/^\.local-editor\/(?:pages|groups|order|names)\.json$/.test(name)||/^public\/(?:editor-media|tactics)\//.test(name))return 'content';
  return 'other';
}

async function status(root){
  const top=path.resolve((await git(root,['rev-parse','--show-toplevel'])).trim());
  if(path.relative(root,top))throw Error('请选择 Git 仓库的根目录。');
  const branch=(await git(root,['branch','--show-current'])).trim();
  if(!branch)throw Error('请先切换到一个本地分支。');
  const head=(await git(root,['rev-parse','HEAD'])).trim();
  const output=await git(root,['status','--porcelain=v1','-z','--untracked-files=all','--no-renames']);
  const files=output.split('\0').filter(Boolean).map(row=>({code:row.slice(0,2),name:row.slice(3),policy:filePolicy(row.slice(3))}));
  return {branch,head,files};
}

async function version(root,file){
  if(file.code.includes('D')){
    try{await fs.lstat(path.join(root,file.name));}catch(error){if(error.code==='ENOENT')return 'deleted';throw error;}
  }
  const stat=await fs.lstat(path.join(root,file.name));
  if(stat.isSymbolicLink()||!stat.isFile())throw Error('无法提交此文件：'+file.name);
  if(stat.size>=100*1024*1024)throw Error('文件达到 GitHub 的 100 MiB 限制：'+file.name);
  return (await git(root,['hash-object','--',file.name])).trim();
}

async function review(root,name){
  const current=await status(root);
  const file=current.files.find(item=>item.name===name&&item.policy!=='blocked');
  if(!file)throw Error('文件已变化，请刷新列表。');
  const hash=await version(root,file);
  const args=file.code==='??'?['diff','--no-index','--no-ext-diff','--no-textconv','--','/dev/null',name]:['diff','--no-ext-diff','--no-textconv','HEAD','--',name];
  let diff;
  try{diff=await git(root,args,{limit:512*1024,ok:[0,1]});}
  catch(error){if(error.code!=='ERR_CHILD_PROCESS_STDIO_MAXBUFFER')throw error;diff=error.stdout.slice(0,100000)+'\n\n差异过长，剩余内容已省略。';}
  return {diff,hash,head:current.head,code:file.code};
}

async function commit(root,selection,message){
  if(!Array.isArray(selection)||!selection.length||selection.length>1000||typeof message!=='string'||!message.trim()||message.length>500||message.includes('\0'))throw Error('请选择文件并填写提交说明。');
  const current=await status(root);
  if(current.files.some(file=>/U/.test(file.code)||['AA','DD'].includes(file.code)))throw Error('请先解决 Git 合并冲突。');
  const files=new Map(current.files.map(file=>[file.name,file]));
  const names=[];const untracked=[];
  for(const item of selection){
    const file=files.get(item?.name);
    if(!file||file.policy==='blocked'||current.head!==item.head||item.code!==file.code||await version(root,file)!==item.hash)throw Error('所选文件已变化，请刷新并重新核对。');
    if(file.code==='??')untracked.push(file.name);
    names.push(file.name);files.delete(file.name);
  }
  if(untracked.length)await git(root,['add','-N','--',...untracked]);
  await git(root,['commit','--only','-m',message.trim(),'--',...names]);
  return (await git(root,['rev-parse','--short','HEAD'])).trim();
}

function githubRemote(value){
  if(!/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)[\w.-]+\/[\w.-]+$/i.test(value))throw Error('origin 的推送地址必须指向 GitHub 仓库。');
  return value;
}

async function pushPlan(root,validateRemote=githubRemote){
  const {head,branch}=await status(root);
  const remote=validateRemote((await git(root,['remote','get-url','--push','origin'])).trim());
  const ref='refs/heads/'+branch;
  const listing=await git(root,['ls-remote','--refs',remote,ref]);
  const base=listing.trim().split(/\s/)[0];
  if(!base)throw Error('GitHub 上还没有这个分支，请先创建对应的远程分支。');
  await git(root,['fetch','--no-tags','--no-recurse-submodules',remote,ref]);
  const fetched=(await git(root,['rev-parse','FETCH_HEAD'])).trim();
  if(base!==fetched)throw Error('远程分支刚刚更新，请重试。');
  if((await git(root,['merge-base',base,head])).trim()!==base)throw Error('远程分支有本地未包含的提交，请先同步远程。');
  const commits=(await git(root,['log','--format=%h %s',`${base}..${head}`])).trim();
  const changes=(await git(root,['diff','--stat',base,head])).trim();
  const paths=(await git(root,['log','--format=','--name-only','-z',`${base}..${head}`])).split('\0').filter(Boolean);
  if(paths.some(name=>filePolicy(name)==='blocked'))throw Error('待推送的提交包含受保护的文件。');
  return {head,branch,remote,ref,base,commits,changes};
}

async function push(root,plan,validateRemote=githubRemote){
  const now=await pushPlan(root,validateRemote);
  if(now.head!==plan.head||now.base!==plan.base||now.remote!==plan.remote||now.ref!==plan.ref)throw Error('本地或远程提交已变化，请重新核对。');
  if(!now.commits)return false;
  await git(root,['-c','push.followTags=false','push','--porcelain',now.remote,`${now.head}:${now.ref}`]);
  return true;
}

module.exports={status,review,commit,pushPlan,push};
