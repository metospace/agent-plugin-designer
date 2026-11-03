/** Enforced orchestration limits only. These are not token, billing, or remote cancellation guarantees. */
export const defaultLimits = Object.freeze({maxSteps:1000,maxDispatches:100,timeoutMs:1800000,dispatchTimeoutMs:300000,hostCheckTimeoutMs:10000,cleanupTimeoutMs:5000});
export function executionLimits(value={}) {
 if(!value || typeof value!=='object' || Array.isArray(value))throw Error('limits must be an object');
 for(const key of Object.keys(value))if(!Object.hasOwn(defaultLimits,key))throw Error('Unsupported execution limit: '+key);
 const limits={...defaultLimits,...value};
 for(const [key,value] of Object.entries(limits))if(!Number.isSafeInteger(value)||value<1||value>2147483647)throw Error('Invalid execution limit: '+key);
 return limits;
}
export async function bounded(operation,ms,label,onLate,onTimeout) {
 let timer,expired=false;
 const work=Promise.resolve().then(operation);
 work.then(value=>{if(expired&&onLate)Promise.resolve().then(()=>onLate(value)).catch(()=>{});},()=>{});
 try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error(label+' timed out; inspect host state before explicit retry_dispatch'));onTimeout?.();},Math.max(1,ms));})]);}
 finally{clearTimeout(timer);}
}
