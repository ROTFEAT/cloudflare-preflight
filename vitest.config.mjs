import {defineConfig} from 'vitest/config';
import {cloudflareTest} from '@cloudflare/vitest-plugin';
export default defineConfig({
  cacheDir:'/tmp/cloudflare-cost-safety-vite',
  plugins:[cloudflareTest({wrangler:{configPath:'tests/runtime/wrangler.jsonc'},miniflare:{outboundService:()=>new Response('Outbound network disabled in tests',{status:403})}})],
  test:{include:['tests/runtime/*.spec.js'],testTimeout:10000,hookTimeout:10000,maxWorkers:1,fileParallelism:false,reporters:['default']}
});
