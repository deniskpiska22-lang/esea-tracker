export async function downloadShareCard(svg,filename='esea-tracker-team.png') {
 const clone=svg.cloneNode(true);let fallback=false,source;
 for(const image of clone.querySelectorAll('image')){
  try{const response=await fetch(image.getAttribute('data-export-src')||image.getAttribute('href'),{credentials:'omit',signal:AbortSignal.timeout(7000)});if(!response.ok)throw new Error('image');const blob=await response.blob();if(!blob.type.startsWith('image/')||blob.size>5000000)throw new Error('image');
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});image.setAttribute('href',data);
  }catch{image.remove();fallback=true;}
 }
 try{source=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=source;});const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;canvas.getContext('2d').drawImage(image,0,0);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw new Error('PNG unavailable');const href=URL.createObjectURL(png);const a=document.createElement('a');a.href=href;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(href),10000);return {fallback};}finally{if(source)URL.revokeObjectURL(source);}
}
