import {Buffer} from 'node:buffer';
import {validFaceitAvatar} from '../src/utils/teamAvatar.js';
export async function readShareLogo(url,fetchImpl=fetch){
 const target=validFaceitAvatar(url);if(!target)return null;
 const response=await fetchImpl(target,{redirect:'manual',signal:AbortSignal.timeout(7000)});
 if(!response.ok||response.status>=300||Number(response.headers.get('content-length'))>5000000)return null;
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5000000){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}
 const data=Buffer.concat(chunks);
 const type=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'?'image/webp':/^GIF8[79]a$/.test(data.toString('ascii',0,6))?'image/gif':null;
 return type?{data,type}:null;
}
