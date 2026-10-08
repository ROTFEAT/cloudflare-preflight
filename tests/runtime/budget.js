// This limits the test harness, not a production Cloudflare account.
export class Budget {
  constructor(limits={events:50,messages:50,rows:10000}){this.limits=limits;this.used=Object.fromEntries(Object.keys(limits).map(k=>[k,0]));}
  charge(unit,count=1){if(!(unit in this.limits)||!Number.isSafeInteger(count)||count<0)throw new Error('invalid fixture charge');if(this.used[unit]+count>this.limits[unit])throw new Error(`fixture ${unit} budget exhausted`);this.used[unit]+=count;}
}
