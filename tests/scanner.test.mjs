import test from 'node:test';
import assert from 'node:assert/strict';
import {startScanner} from '../scanner.js';

function install(t,{formats=['ean_13'],getMedia,detector,library}={}) {
  const originals=new Map(['isSecureContext','navigator','BarcodeDetector','ZXingBrowser','setTimeout','clearTimeout'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  let stops=0,paused=0;
  const stream={getTracks:()=>[{stop:()=>stops++}]};
  const video={srcObject:null,play:async()=>{},pause:()=>paused++};
  const scheduled=[];
  for(const [key,value] of Object.entries({isSecureContext:true,navigator:{mediaDevices:{getUserMedia:getMedia||async function(){return stream;}}},BarcodeDetector:class{static async getSupportedFormats(){return formats;}async detect(){return detector?detector():[];}},ZXingBrowser:library,setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},clearTimeout:()=>{}}))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  return {video,stream,scheduled,stops:()=>stops,paused:()=>paused};
}

test('native scanner releases camera and stops after one valid product',async t=>{
  const env=install(t,{detector:()=>[{rawValue:'3017620422003'}]});const found=[];
  await startScanner(env.video,code=>found.push(code));
  assert.equal(env.video.srcObject,env.stream);await env.scheduled[0]();
  assert.deepEqual(found,['3017620422003']);assert.equal(env.stops(),1);assert.equal(env.video.srcObject,null);
});
test('closing scanner stops tracks; late frame results cannot trigger lookup',async t=>{
  let resolve;const pending=new Promise(r=>resolve=r),env=install(t,{detector:()=>pending});const found=[];
  const stop=await startScanner(env.video,code=>found.push(code));const tick=env.scheduled[0]();stop();resolve([{rawValue:'3017620422003'}]);await tick;
  assert.equal(env.stops(),1);assert.deepEqual(found,[]);assert.equal(env.scheduled.length,1);
});
test('invalid barcode does not terminate the native scan',async t=>{
  const env=install(t,{detector:()=>[{rawValue:'not-a-product'}]});const found=[];
  const stop=await startScanner(env.video,code=>found.push(code));await env.scheduled[0]();assert.equal(env.scheduled.length,2);assert.deepEqual(found,[]);stop();
});
test('permission failure is explained without leaving a video stream',async t=>{
  const env=install(t,{getMedia:async()=>{throw new DOMException('No','NotAllowedError');}});
  await assert.rejects(startScanner(env.video,()=>{}),/negato/);assert.equal(env.video.srcObject,null);
});
test('unsupported native formats use bundled ZXing and release controls',async t=>{
  let callback,controlStops=0;const controls={stop:()=>controlStops++};
  const library={BrowserMultiFormatReader:class{async decodeFromStream(stream,video,cb){callback=cb;return controls;}}};
  const env=install(t,{formats:[],library});const found=[];
  await startScanner(env.video,code=>found.push(code));callback({getText:()=> '3017620422003'},null,controls);
  assert.deepEqual(found,['3017620422003']);assert(env.stops()>=1);assert(controlStops>=1);
});
