export function decorateTable(table) {
  for(const cell of table.querySelectorAll('thead th'))cell.scope='col';
  for(const row of table.tBodies){for(const tr of row.rows){
    const cell=tr.cells[0];if(!cell)continue;
    if(cell.tagName!=='TH'){const head=document.createElement('th');head.innerHTML=cell.innerHTML;head.scope='row';cell.replaceWith(head);}else cell.scope='row';
  }}
}
export function focusCell(cell) {
  if(!cell)return;
  cell.closest('[contenteditable]')?.focus();const r=document.createRange();r.selectNodeContents(cell);r.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);
}
export function changeTable(table,cell,action){
  const rows=[...table.rows];const row=rows.indexOf(cell.closest('tr'));const column=cell.cellIndex;
  if(row<0||column<0)throw new Error('请先选择表格中的单元格。');
  const matrix=rows.map(tr=>[...tr.cells].map(td=>td.innerHTML));
  let nextRow=row,nextColumn=column;
  if(action==='row-before'||action==='row-after'){nextRow=row+(action==='row-after'?1:0);matrix.splice(nextRow,0,Array(matrix[0].length).fill(''));}
  else if(action==='column-before'||action==='column-after'){nextColumn=column+(action==='column-after'?1:0);for(const r of matrix)r.splice(nextColumn,0,'');}
  else if(action==='delete-row'){matrix.splice(row,1);nextRow=Math.min(row,matrix.length-1);}
  else if(action==='delete-column'){for(const r of matrix)r.splice(column,1);nextColumn=Math.min(column,(matrix[0]?.length||0)-1);}
  else throw new Error('不支持的表格操作');
  if(!matrix.length||!matrix[0].length)return null;
  const thead=document.createElement('thead'),tbody=document.createElement('tbody');
  matrix.forEach((values,i)=>{const tr=document.createElement('tr');values.forEach((html,j)=>{const c=document.createElement(i===0||j===0?'th':'td');if(c.tagName==='TH')c.scope=i===0?'col':'row';c.innerHTML=html||'<br>';tr.append(c);});(i===0?thead:tbody).append(tr);});
  table.replaceChildren(thead,tbody);return table.rows[nextRow].cells[nextColumn];
}
