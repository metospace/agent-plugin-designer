import { expect, test, vi } from 'vitest';
import { createWebAiBridge, webEndpoint } from './web-ai';
import { buildAIRequest } from './ai';
const request = () => buildAIRequest({config:{baseURL:'https://provider.example/v1',model:'test',apiKey:'test-key'},description:'draft',mode:'append'});
test('web endpoint permits TLS and loopback only, no embedded secrets, fragments or query',()=>{
 expect(webEndpoint('https://provider.example/v1/')).toBe('https://provider.example/v1/chat/completions');
 expect(webEndpoint('http://localhost:8000/v1/chat/completions')).toBe('http://localhost:8000/v1/chat/completions');
 for(const url of ['http://public.example/v1','https://user:pass@provider.example/v1','https://provider.example/v1?key=secret','https://provider.example/#key','file:///tmp/a','javascript:alert(1)'])expect(()=>webEndpoint(url)).toThrow('invalid_url');
});
test('browser request sends only expected fields without cookies or redirects',async()=>{
 const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'{}'}}]})));
 expect(await createWebAiBridge(fetcher).call('AI.Complete',request())).toEqual({content:'{}'});
 const [url, options]=fetcher.mock.calls[0];expect(url).toBe('https://provider.example/v1/chat/completions');expect(options).toMatchObject({credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});
 expect(JSON.parse(options!.body as string)).toEqual({model:'test',messages:request().messages,stream:false});expect(options?.body).not.toContain('test-key');
});
test('browser errors do not expose provider secrets or raw bodies',async()=>{
 for(const [status,error] of [[401,'unauthorized'],[429,'rate_limit'],[500,'http_error']] as const){const fake=vi.fn<typeof fetch>().mockResolvedValue(new Response('sensitive raw response',{status}));expect(await createWebAiBridge(fake).call('AI.Complete',request())).toEqual({error});}
 const fake=vi.fn<typeof fetch>().mockRejectedValue(Error('raw secret'));expect(await createWebAiBridge(fake).call('AI.Complete',request())).toEqual({error:'browser_network'});
});
test('browser refuses oversized responses, tools and invalid content',async()=>{
 for(const [body,error] of [['x'.repeat(1000001),'too_large'],[JSON.stringify({choices:[{message:{content:'{}',tool_calls:[{}]}}]}),'tool_calls'],['{}','invalid_response']] as const){const fake=vi.fn<typeof fetch>().mockResolvedValue(new Response(body));expect(await createWebAiBridge(fake).call('AI.Complete',request())).toEqual({error});}
});
test('matching browser cancellation aborts only that pending request',async()=>{
 let signal:AbortSignal|undefined;const fake=vi.fn<typeof fetch>().mockImplementation(async(_url,options)=>{signal=options!.signal!;return new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(Error('aborted'))));});
 const bridge=createWebAiBridge(fake),input=request(),pending=bridge.call('AI.Complete',input);await bridge.call('AI.Cancel','not-this-request');expect(signal?.aborted).toBe(false);await bridge.call('AI.Cancel',input.requestId);expect(await pending).toEqual({error:'cancelled'});
});

test('web matches desktop root URL default and rejects key in URL or body before fetch',async()=>{
 expect(webEndpoint('https://provider.example')).toBe('https://provider.example/v1/chat/completions');
 for(const override of [{baseURL:'https://provider.example/test-key/v1'},{baseURL:'https://provider.example/test%2Dkey/v1'},{model:'test-key'}]){const fake=vi.fn<typeof fetch>();expect(await createWebAiBridge(fake).call('AI.Complete',{...request(),...override})).toEqual({error:'sensitive_input'});expect(fake).not.toHaveBeenCalled();}
});

test('empty keys do not reject anonymous local APIs or add an auth header',async()=>{
 const fake=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'{}'}}]})));
 expect(await createWebAiBridge(fake).call('AI.Complete',{...request(),apiKey:'',baseURL:'http://localhost:8000'})).toEqual({content:'{}'});
 expect(fake).toHaveBeenCalledOnce();expect(fake.mock.calls[0][1]?.headers).toEqual({'Content-Type':'application/json'});
});
