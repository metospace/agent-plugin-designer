import type { AiBridge, AiRequest, AiResponse } from './ai';

/** Browser-only transport. No hosted proxy, stored key, cookies or redirects. */
export function webEndpoint(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw Error('invalid_url'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) throw Error('invalid_url');
  url.pathname = url.pathname.replace(/\/+$/, '') || '/v1';
  if (!url.pathname.endsWith('/chat/completions')) url.pathname += '/chat/completions';
  return url.href;
}

export function createWebAiBridge(fetcher: typeof fetch = fetch): AiBridge {
  const pending = new Map<string, AbortController>();
  return { async call(method, ...args): Promise<AiResponse | boolean> {
    if (method === 'AI.Cancel') { pending.get(String(args[0]))?.abort(); return true; }
    if (method !== 'AI.Complete') return { error: 'invalid_request' };
    const request = args[0] as AiRequest;
    let endpoint: string;
    try { endpoint = webEndpoint(request.baseURL); } catch { return { error: 'browser_invalid_url' }; }
    const body = JSON.stringify({ model: request.model, messages: request.messages, stream: false });
    let decodedEndpoint = endpoint;
    try { decodedEndpoint = decodeURIComponent(endpoint); } catch { return { error: 'browser_invalid_url' }; }
    if (request.apiKey && (request.baseURL.includes(request.apiKey) || endpoint.includes(request.apiKey) || decodedEndpoint.includes(request.apiKey) || request.model.includes(request.apiKey) || request.messages.some(message => message.content.includes(request.apiKey)) || body.includes(request.apiKey))) return { error: 'sensitive_input' };
    if (new TextEncoder().encode(body).byteLength > 512 * 1024) return { error: 'too_large' };
    if (pending.has(request.requestId)) return { error: 'duplicate_request' };
    const controller = new AbortController();
    pending.set(request.requestId, controller);
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 60_000);
    try {
      const response = await fetcher(endpoint, {
        method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(request.apiKey ? { Authorization: 'Bearer ' + request.apiKey } : {}) },
        body,
      });
      if (!response.ok) { await response.body?.cancel(); return { error: response.status === 401 || response.status === 403 ? 'unauthorized' : response.status === 429 ? 'rate_limit' : 'http_error' }; }
      if (!response.body) return { error: 'invalid_response' };
      const reader = response.body.getReader();
      const decoder = new TextDecoder(); let content = ''; let bytes = 0;
      try {
        while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 1_000_000) { await reader.cancel(); return { error: 'too_large' }; } content += decoder.decode(value, { stream: true }); }
        content += decoder.decode();
      } finally { reader.releaseLock(); }
      let data;
      try { data = JSON.parse(content); } catch { return { error: 'invalid_response' }; }
      const message = data?.choices?.[0]?.message;
      if (message?.tool_calls?.length || message?.function_call) return { error: 'tool_calls' };
      if (typeof message?.content !== 'string') return { error: 'invalid_response' };
      return { content: message.content };
    } catch { return { error: timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : 'browser_network' }; }
    finally { clearTimeout(timeout); pending.delete(request.requestId); }
  } };
}
