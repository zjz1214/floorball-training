const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('floorballDesktop',{
  reportState:state=>ipcRenderer.send('desktop:state',{dirty:state.dirty===true,busy:state.busy===true,canSave:state.canSave===true}),
  onSaveRequest:callback=>{ipcRenderer.on('desktop:save',async(_,id)=>{let ok=false;try{ok=(await callback())===true;}catch{}ipcRenderer.send('desktop:save-result',{id,ok});});},
  openPreview:name=>ipcRenderer.invoke('desktop:preview',name),
  github:(action,data)=>ipcRenderer.invoke('desktop:github',action,data),
  writeBlockClipboard:value=>ipcRenderer.invoke('desktop:block-copy',value),
  readBlockClipboard:()=>ipcRenderer.invoke('desktop:block-paste')
});
