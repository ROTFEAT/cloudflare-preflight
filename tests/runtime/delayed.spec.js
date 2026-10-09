import {it,expect,afterEach} from 'vitest';
import {env} from 'cloudflare:workers';
import {reset,evictDurableObject,runInDurableObject} from 'cloudflare:test';
import {Budget} from './budget.js';

afterEach(async()=>{await reset();});
const day=86400000,epoch=Date.UTC(2050,0,1);
const task=()=>env.REFRESH.getByName(crypto.randomUUID());

it('virtual days 23 and 30 advance a durable refresh and do not repeat completed work',async()=>{
  const object=task();await object.start(epoch);
  expect((await object.tick(epoch+23*day-1)).work).toBe(0);
  expect((await object.tick(epoch+23*day)).work).toBe(1);
  await evictDurableObject(object);
  for(const now of [epoch+23*day+1,epoch+30*day-1,epoch+30*day,epoch+30*day+1])expect((await object.tick(now)).work).toBe(0);
  const state=await object.stats();expect(state.work).toBe(1);expect(state.next).toBe(epoch+46*day);expect(state.alarm).toBeGreaterThan(epoch+30*day);
});

it('a successful stale-timestamp refresh still creates repeated work within the fixture budget',async()=>{
  const object=task();await object.start(epoch,true);
  const budget=new Budget({events:8});let work=0;
  for(let event=0;event<8;event++){budget.charge('events');work+=(await object.tick(epoch+23*day)).work;}
  expect(work).toBe(8);expect((await object.stats()).next).toBe(epoch+23*day);
  expect(()=>budget.charge('events')).toThrow('budget exhausted');
});

it('missed refresh expires at and beyond day 30 without rearming after restart',async()=>{
  for(const now of [epoch+30*day,epoch+30*day+1]){
    const object=task();await object.start(epoch);expect((await object.tick(now)).rescheduled).toBe(false);
    await evictDurableObject(object);expect((await object.tick(now+day)).rescheduled).toBe(false);
    expect(await object.stats()).toMatchObject({status:'expired',work:0,alarm:null});
  }
});

it('non-finite and backwards clocks cannot create an invalid next schedule',async()=>{
  const object=task();await object.start(epoch);const before=await object.stats();
  for(const now of [NaN,Infinity,epoch-1]){
    const error=await runInDurableObject(object,async instance=>{try{await instance.tick(now);return null;}catch(error){return error.message;}});
    expect(error).toMatch(/fixture clock/);
  }
  expect(await object.stats()).toEqual(before);
});

it('a persisted stop bounds queued and replayed callbacks across eviction',async()=>{
  const object=task();await object.start(epoch);await object.tick(epoch+23*day);
  await object.stop();const queued=await object.tick(epoch+23*day+1);
  await evictDurableObject(object);const replayed=await object.tick(epoch+24*day);
  expect(queued.work+replayed.work).toBe(0);
  expect(queued.controlReads+replayed.controlReads).toBe(2);
  expect(queued.rescheduled||replayed.rescheduled).toBe(false);
  expect(await object.stats()).toMatchObject({status:'disabled',work:1,alarm:null});
  console.log('Stop model',JSON.stringify({queuedCallbacks:2,additionalLogicalRefreshes:0,controlReads:2,newSchedules:0}));
});
