import { useEffect, useRef, useState } from 'react';
import type { Project } from './model';
import { aiBridgeAvailable, applyAiPreview, fingerprintProject, prepareAiDraft, requestAiDraft } from './ai';
import type { AiContext, AiMode, AiPreview } from './ai';
import './ai.css';

/** Credentials and conversation live only in this mounted panel. App owns the only
 * project mutation: onApply must compare expectedFingerprint with the latest
 * project, return false on conflict, and call its normal update once for undo. */
export type AiPanelProps = {
  project: Project;
  selectedNodeId?: string;
  onApply: (nextProject: Project, expectedFingerprint: string) => boolean | void;
  onClose?: () => void;
};
type Scope = 'description' | 'selected' | 'project';
type Message = { role: 'user' | 'assistant'; text: string };
const kinds: Record<string, string> = { start: '开始', agent: 'Agent', condition: '条件', human: '人工', end: '结束', fork: '并行', join: '汇合' };

export default function AiPanel({ project, selectedNodeId, onApply, onClose }: AiPanelProps) {
  const [baseURL, setBaseURL] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<Scope>('description');
  const [mode, setMode] = useState<AiMode>(project.nodes.length ? 'append' : 'create');
  const [confirmed, setConfirmed] = useState(false);
  const [allowHTTP, setAllowHTTP] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [previewBase, setPreviewBase] = useState<Project | null>(null);
  const [previewMode, setPreviewMode] = useState<AiMode>('append');
  const [applied, setApplied] = useState(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const appliedRef = useRef(false);
  const latestProject = useRef(project);
  latestProject.current = project;
  const fingerprint = fingerprintProject(project);
  const selected = project.nodes.find(n => n.id === selectedNodeId);
  let remoteHTTP = false;
  try { const u = new URL(baseURL); remoteHTTP = u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname); } catch { /* engine validates at send */ }
  const available = aiBridgeAvailable();
  const context: AiContext | undefined = scope === 'project'
    ? { nodes: project.nodes, edges: project.edges, roles: project.roles, skills: project.skills }
    : scope === 'selected' && selected
      ? (() => { const roles = project.roles.filter(r => r.id === selected.data.roleId); const ids = new Set(roles.flatMap(r => r.bindings.map(b => b.skillId))); return { nodes: [selected], edges: [], roles, skills: project.skills.filter(s => ids.has(s.id)) }; })()
      : undefined;
  const conflict = !!preview && preview.baseFingerprint !== fingerprint;
  useEffect(() => { setConfirmed(false); }, [scope, selectedNodeId, fingerprint, mode]);
  useEffect(() => { setAllowHTTP(false); }, [baseURL]);
  useEffect(() => () => { requestId.current++; controller.current?.abort(); }, []);

  function cancel() {
    requestId.current++;
    controller.current?.abort();
    controller.current = null;
    inFlight.current = false;
    setBusy(false);
    setNotice('已取消，本次响应不会应用到画布。');
  }
  async function send() {
    if (inFlight.current) return;
    setError(''); setNotice('');
    if (!available) { setError('AI 连接需要 Windows 桌面版。浏览器预览无法调用桌面连接，请在桌面版配置 API。'); return; }
    if (!description.trim()) { setError('先描述你希望 AI 生成或修改的步骤。'); return; }
    if (apiKey && description.includes(apiKey)) { setError('描述中包含当前 API Key，请先移除密钥再发送。'); return; }
    if (!baseURL.trim() || !model.trim()) { setError('请填写 API 地址和模型名称。'); return; }
    if (scope === 'selected' && !selected) { setError('请先在画布选中一个节点。'); return; }
    if (mode === 'modify' && (scope !== 'selected' || !selected)) { setError('修改节点需要选择“选中节点”共享范围。'); return; }
    if (scope !== 'description' && !confirmed) { setError('请确认本次发送的共享内容。'); return; }
    if (remoteHTTP && !allowHTTP) { setError('远程 HTTP 连接未加密，请先明确确认。'); return; }
    const snapshot = structuredClone(project);
    const requestMode: AiMode = mode === 'modify' ? 'modify' : snapshot.nodes.length ? 'append' : 'create';
    const snapshotFingerprint = fingerprintProject(snapshot);
    const selectedIds = scope === 'selected' && selected ? [selected.id] : undefined;
    const id = ++requestId.current;
    const abort = new AbortController(); controller.current = abort;
    inFlight.current = true; setBusy(true); setPreview(null); setApplied(false); appliedRef.current = false;
    const text = description.trim();
    setMessages(old => [...old, { role: 'user', text }]);
    setConfirmed(false);
    try {
      const draft = await requestAiDraft({ config: { baseURL: baseURL.trim(), model: model.trim(), apiKey, allowInsecureHTTP: remoteHTTP && allowHTTP }, description: text, mode: requestMode, context: context ? structuredClone(context) : undefined, selectedNodeIds: selectedIds, signal: abort.signal });
      if (id !== requestId.current || abort.signal.aborted) return;
      const next = prepareAiDraft(snapshot, draft, { mode: requestMode, selectedNodeIds: selectedIds, allowedNodeIds: context?.nodes?.map(n => n.id), allowedRoleIds: context?.roles?.map(r => r.id) });
      setPreview(next);
      setPreviewBase(snapshot);
      setPreviewMode(requestMode);
      setMessages(old => [...old, { role: 'assistant', text: draft.summary }]);
      if (fingerprintProject(latestProject.current) !== snapshotFingerprint) setNotice('生成期间流程已改变。此草案不能应用，请基于当前流程重新生成。');
    } catch (e) {
      if (id !== requestId.current || abort.signal.aborted) return;
      // ai.ts exposes only friendly validated errors, never a provider response body.
      setError(e instanceof Error ? e.message : '生成失败，请检查连接配置后重试。');
    } finally {
      if (id === requestId.current) { inFlight.current = false; controller.current = null; setBusy(false); }
    }
  }
  function apply() {
    if (!preview || busy || appliedRef.current) return;
    setError('');
    if (fingerprintProject(latestProject.current) !== preview.baseFingerprint) { setError('流程已改变，无法应用旧草案。请重新生成。'); return; }
    appliedRef.current = true;
    try {
      const next = applyAiPreview(latestProject.current, preview);
      if (onApply(next, preview.baseFingerprint) === false) { setError('流程已改变，无法应用旧草案。请重新生成。'); return; }
      setApplied(true); setNotice('已应用到画布，可用工具栏“撤销”一次撤回本次修改。');
    } catch (e) { setError(e instanceof Error ? e.message : '草案无法应用，请重新生成。'); }
  }
  const addedNodes = preview?.nextProject.nodes.filter(n => !previewBase?.nodes.some(old => old.id === n.id)) ?? [];
  const addedRoles = preview?.nextProject.roles.filter(r => !previewBase?.roles.some(old => old.id === r.id)) ?? [];
  const addedEdges = preview?.nextProject.edges.filter(e => !previewBase?.edges.some(old => old.id === e.id)) ?? [];

  return <section className="ai-panel" aria-label="AI 辅助设计" data-testid="ai-panel">
    <div className="ai-heading"><div><h2>AI 辅助设计</h2><p>描述流程，预览后再加入画布。</p></div>{onClose && <button type="button" aria-label="关闭 AI 面板" onClick={onClose}>×</button>}</div>
    <p className="ai-subtle">兼容 OpenAI 风格的 chat/completions API。仅在点击发送后连接；供应商可能按用量计费。配置和对话只保留在本次面板会话。</p>
    {!available && <p className="ai-warning" role="status">浏览器预览无法连接 AI；请使用 Windows 桌面版。</p>}
    <details className="ai-config" open><summary>API 连接配置</summary><fieldset disabled={busy}>
      <label>API 地址<input aria-label="API 地址" type="url" value={baseURL} onChange={e => setBaseURL(e.target.value)} autoComplete="off" spellCheck={false} placeholder="https://api.example.com/v1" /></label>
      <label>模型名称<input aria-label="模型名称" value={model} onChange={e => setModel(e.target.value)} autoComplete="off" spellCheck={false} placeholder="填写供应商提供的模型名称" /></label>
      <label>API Key<input aria-label="API Key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="仅保留在当前会话" /></label>
      {remoteHTTP && <label className="ai-check ai-warning"><input type="checkbox" checked={allowHTTP} onChange={e => setAllowHTTP(e.target.checked)} />我确认使用远程 HTTP：密钥与内容会明文传输</label>}
    </fieldset></details>
    <fieldset className="ai-modes" disabled={busy}><legend>这次要做什么</legend>
      <label><input type="radio" name="ai-mode" checked={mode !== 'modify'} onChange={() => { setMode(project.nodes.length ? 'append' : 'create'); setConfirmed(false); }} />{project.nodes.length ? '追加新节点' : '生成新流程'}</label>
      <label><input type="radio" name="ai-mode" checked={mode === 'modify'} onChange={() => { setMode('modify'); setScope('selected'); setConfirmed(false); }} />修改选中节点</label>
    </fieldset>
    <fieldset className="ai-scope" disabled={busy}><legend>本次共享范围</legend>
      <label><input type="radio" name="ai-scope" checked={scope === 'description'} onChange={() => setScope('description')} />只发文字描述（默认）</label>
      <label><input type="radio" name="ai-scope" checked={scope === 'selected'} onChange={() => setScope('selected')} />选中节点{selected ? `：${selected.data.label}` : '（未选中）'}</label>
      <label><input type="radio" name="ai-scope" checked={scope === 'project'} onChange={() => setScope('project')} />整个流程（节点、连线、角色、技能）</label>
      {scope !== 'description' && <div className="ai-share"><p>{scope === 'selected' ? '仅发送当前节点、其绑定角色及技能；不发送其他节点和连线。' : '将发送此流程全部节点、连线、角色和技能（含技能资源）。'}</p>
        <details><summary>查看本次将共享的内容</summary><pre>{JSON.stringify(context ?? {}, null, 2)}</pre></details>
        <label className="ai-check"><input aria-label="确认本次共享内容" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />我确认本次发送以上内容到配置的 API</label>
      </div>}
    </fieldset>
    <p className="ai-subtle">每条消息单独发送，不自动附带此前对话。默认不发送当前流程；AI 输出仅作为设计草案，不执行代码或工具。</p>
    {messages.length > 0 && <div className="ai-messages" aria-label="本次对话">{messages.map((m, i) => <div key={i} className={`ai-message ai-${m.role}`}><strong>{m.role === 'user' ? '你' : 'AI 草案'}</strong><p>{m.text}</p></div>)}</div>}
    <label className="ai-prompt">描述你的想法<textarea aria-label="描述你的想法" value={description} onChange={e => setDescription(e.target.value)} disabled={busy} maxLength={20000} rows={4} placeholder="例如：加入一个收集需求的 Agent，再由人工确认后交给开发。" /></label>
    <div className="ai-actions"><button type="button" disabled={busy} onClick={() => void send()}>{busy ? '正在生成…' : preview ? '继续聊 / 重新生成' : '发送并生成草案'}</button>{busy && <button type="button" onClick={cancel}>取消生成</button>}</div>
    {error && <p className="ai-error" role="alert">{error}</p>}{notice && <p className="ai-notice" role="status">{notice}</p>}
    {preview && <section className="ai-preview" aria-label="草案预览" data-testid="ai-preview"><h3>草案预览</h3><p>{preview.summary}</p>
      <p>{previewMode === 'modify' ? '仅修改确认的选中节点，其他原图内容保留。' : '追加节点、角色和连线，原图保留。'}</p>
      <ul>{preview.changes.map((change, i) => <li key={i}>{change}</li>)}</ul>
      {!!addedNodes.length && <div><h4>新增节点</h4><ul>{addedNodes.map(n => <li key={n.id}>{n.data.label} · {kinds[n.data.kind]}<p>{n.data.description}</p></li>)}</ul></div>}
      {!!addedRoles.length && <div><h4>新增角色</h4><ul>{addedRoles.map(r => <li key={r.id}>{r.name}：{r.responsibility}</li>)}</ul></div>}
      {!!addedEdges.length && <div><h4>新增连线</h4><ul>{addedEdges.map(e => { const label = (id: string) => preview.nextProject.nodes.find(n => n.id === id)?.data.label ?? id; return <li key={e.id}>{label(e.source)} → {label(e.target)}{e.data.condition ? `（${e.data.condition}）` : ''}</li>; })}</ul></div>}
      {previewMode === 'modify' && <ul>{preview.nextProject.nodes.filter(n => previewBase?.nodes.some(old => old.id === n.id && JSON.stringify(old) !== JSON.stringify(n))).map(n => <li key={n.id}>{n.data.label}<p>{n.data.description}</p>{n.data.delivery && <p>交付：{n.data.delivery}</p>}</li>)}</ul>}
      {conflict && !applied && <p className="ai-warning" role="status">流程已改变，此草案已过期。请重新生成后再应用。</p>}
      <button type="button" disabled={busy || conflict || applied || appliedRef.current} onClick={apply}>{applied ? '已应用' : '应用到画布'}</button>
    </section>}
  </section>;
}
