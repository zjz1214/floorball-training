const invoke=window.floorballDesktop?.github;
if(invoke){
  const find=id=>document.getElementById(id);
  const dialog=find('github-dialog');
  const list=find('github-files');
  const diff=find('github-diff');
  const status=find('github-status');
  const commitButton=find('github-commit');
  const pushButton=find('github-push');
  const refreshButton=find('github-refresh');
  let busy=false;
  const reviewed=new Map();

  async function run(operation){
    if(busy)return;
    busy=true;
    status.textContent='正在处理…';
    for(const button of [commitButton,pushButton,refreshButton,find('github-close')])button.disabled=true;
    list.inert=true;
    try{await operation();}catch(error){status.textContent=error.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
    finally{
      busy=false;
      for(const button of [commitButton,pushButton,refreshButton,find('github-close')])button.disabled=false;
      list.inert=false;
    }
  }

  async function refresh(message){
    const data=await invoke('status');
    reviewed.clear();
    list.replaceChildren();
    diff.hidden=true;
    find('github-branch').textContent='当前分支 · '+data.branch;
    for(const file of data.files){
      const row=document.createElement('div');
      row.className='github-file';
      const label=document.createElement('label');
      const checkbox=document.createElement('input');
      checkbox.type='checkbox';
      checkbox.value=file.name;
      checkbox.disabled=file.policy==='blocked';
      checkbox.checked=file.policy==='content'&&!file.code.includes('D');
      const name=document.createElement('span');
      name.textContent=`${file.code.trim()} · ${file.name}`;
      label.append(checkbox,name);
      const view=document.createElement('button');
      view.textContent=file.policy==='blocked'?'受保护':'查看差异';
      view.disabled=checkbox.disabled;
      view.onclick=()=>run(async()=>{
        const result=await invoke('review',file.name);
        reviewed.set(file.name,result);
        diff.textContent=file.name+'\n\n'+(result.diff||'没有相对上次提交的文本差异。');
        diff.hidden=false;
        diff.scrollTop=0;
        status.textContent='';
      });
      row.append(label,view);
      list.append(row);
    }
    status.textContent=message||(data.files.length?`${data.files.length} 个文件有改动，请核对要提交的文件。`:'没有未提交的文件改动。');
  }

  const open=find('github-open');
  open.hidden=false;
  open.onclick=()=>{dialog.showModal();run(()=>refresh());};
  find('github-close').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  refreshButton.onclick=()=>run(()=>refresh());
  commitButton.onclick=()=>run(async()=>{
    const message=find('github-message').value.trim();
    const selected=[...list.querySelectorAll('input:checked:not(:disabled)')].map(input=>input.value);
    if(!selected.length||!message)throw Error('请选择文件并填写提交说明。');
    const files=[];
    for(const name of selected){
      const {hash,head,code}=reviewed.get(name)||await invoke('review',name);
      files.push({name,hash,head,code});
    }
    const result=await invoke('commit',{message,files});
    find('github-message').value='';
    await refresh(`已提交到本地 ${result.commit}。点击“推送到 GitHub”可查看并确认上传。`);
  });
  pushButton.onclick=()=>run(async()=>{
    const result=await invoke('push');
    status.textContent=result.message;
  });
}
