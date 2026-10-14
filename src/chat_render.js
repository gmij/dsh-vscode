'use strict';
// DOM-only Markdown subset: no HTML, URLs, images or executable model content.
function renderMessage(container,text){
 const doc=container.ownerDocument;container.replaceChildren();
 const blocks=String(text).slice(0,262144).split(/```/);
 blocks.forEach((block,index)=>{
  if(index%2){
   const newline=block.indexOf('\n');const code=doc.createElement('code');code.textContent=newline>=0?block.slice(newline+1):block;
   const pre=doc.createElement('pre');pre.append(code);const copy=doc.createElement('button');copy.textContent='复制代码';copy.setAttribute('aria-label','复制代码块');
   copy.onclick=async()=>{try{await navigator.clipboard.writeText(code.textContent);copy.textContent='已复制'}catch(_){copy.textContent='复制失败，请选择代码复制'}};
   container.append(copy,pre);
  }else{
   for(const line of block.split('\n')){
    const heading=/^(#{1,3})\s+(.+)$/.exec(line);const item=doc.createElement(heading?'h'+heading[1].length:'p');
    const value=heading?heading[2]:line;
    value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).forEach(part=>{const tag=part.startsWith('`')?'code':part.startsWith('**')?'strong':'span';const el=doc.createElement(tag);el.textContent=tag==='code'?part.slice(1,-1):tag==='strong'?part.slice(2,-2):part;item.append(el)});
    container.append(item);
   }
  }
 });
}
module.exports={renderMessage};
