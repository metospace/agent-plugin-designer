package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// AI is an explicit, session-only chat/completions client. It never logs or persists requests.
type AI struct {
	mu        sync.Mutex
	pending   map[string]context.CancelFunc
	used      map[string]bool
	cancelled map[string]bool
	timeout   time.Duration
}
type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type AIRequest struct {
	RequestID         string      `json:"requestId"`
	BaseURL           string      `json:"baseURL"`
	Model             string      `json:"model"`
	APIKey            string      `json:"apiKey"`
	AllowInsecureHTTP bool        `json:"allowInsecureHTTP"`
	Messages          []AIMessage `json:"messages"`
}
type AIResponse struct {
	Content string `json:"content,omitempty"`
	Error   string `json:"error,omitempty"`
	Message string `json:"message,omitempty"`
}

func NewAI() *AI {
	return &AI{pending: map[string]context.CancelFunc{}, used: map[string]bool{}, cancelled: map[string]bool{}, timeout: 45 * time.Second}
}
func aiError(code, message string) AIResponse { return AIResponse{Error: code, Message: message} }
func completionURL(raw string, ack bool) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.Opaque != "" {
		return "", errors.New("请提供有效的 HTTP(S) API 地址，不包含账号、查询参数或片段")
	}
	hostname := strings.ToLower(u.Hostname())
	if hostname == "" {
		return "", errors.New("API 地址缺少主机")
	}
	local := hostname == "localhost"
	if ip := net.ParseIP(hostname); ip != nil {
		local = ip.IsLoopback()
	}
	if u.Scheme == "http" && !local && !ack {
		return "", errors.New("远程 HTTP 会明文传输内容与 Key，请明确确认风险或改用 HTTPS")
	}
	path := strings.TrimRight(u.Path, "/")
	if path == "" {
		path = "/v1"
	}
	if !strings.HasSuffix(path, "/chat/completions") {
		path += "/chat/completions"
	}
	u.Path = path
	u.RawPath = ""
	return u.String(), nil
}
func (a *AI) Cancel(requestID string) bool {
	if len(requestID) < 1 || len(requestID) > 120 || strings.ContainsAny(requestID, "\r\n") {
		return false
	}
	a.mu.Lock()
	if cancel := a.pending[requestID]; cancel != nil {
		a.mu.Unlock()
		cancel()
		return true
	}
	if a.used == nil {
		a.used = map[string]bool{}
	}
	if a.cancelled == nil {
		a.cancelled = map[string]bool{}
	}
	if a.used[requestID] || len(a.used) >= 10000 {
		a.mu.Unlock()
		return false
	}
	// A UI cancellation can arrive before its queued bridge request starts.
	a.used[requestID] = true
	a.cancelled[requestID] = true
	a.mu.Unlock()
	return true
}

func (a *AI) Complete(req AIRequest) AIResponse {
	if len(req.RequestID) < 1 || len(req.RequestID) > 120 || strings.ContainsAny(req.RequestID, "\r\n") {
		return aiError("invalid_request", "请求标识无效")
	}
	endpoint, err := completionURL(req.BaseURL, req.AllowInsecureHTTP)
	if err != nil {
		return aiError("invalid_url", err.Error())
	}
	if strings.TrimSpace(req.Model) == "" || len(req.Model) > 200 || len(req.APIKey) > 4096 || strings.ContainsAny(req.APIKey, "\r\n") {
		return aiError("invalid_request", "模型名称或 API Key 格式无效")
	}
	if len(req.Messages) != 2 || req.Messages[0].Role != "system" || req.Messages[1].Role != "user" {
		return aiError("invalid_request", "仅允许明确选择的当前描述与上下文，不接受隐式历史")
	}
	for _, m := range req.Messages {
		if req.APIKey != "" && strings.Contains(m.Content, req.APIKey) {
			return aiError("sensitive_input", "发送内容包含当前 API Key，请先移除")
		}
	}
	body, err := json.Marshal(struct {
		Model    string      `json:"model"`
		Messages []AIMessage `json:"messages"`
		Stream   bool        `json:"stream"`
	}{req.Model, req.Messages, false})
	if req.APIKey != "" && (strings.Contains(endpoint, req.APIKey) || strings.Contains(string(body), req.APIKey)) {
		return aiError("sensitive_input", "API Key 只能用于认证头，请检查地址与发送内容")
	}
	if err != nil || len(body) > 512*1024 {
		return aiError("too_large", "发送内容过大，请减少上下文")
	}
	a.mu.Lock()
	if a.pending == nil {
		a.pending = map[string]context.CancelFunc{}
	}
	if a.used == nil {
		a.used = map[string]bool{}
	}
	if a.used[req.RequestID] {
		if a.cancelled[req.RequestID] {
			a.mu.Unlock()
			return aiError("cancelled", "已取消请求")
		}
		a.mu.Unlock()
		return aiError("duplicate_request", "请求标识已使用，请重新发起请求")
	}
	if len(a.pending) >= 3 || len(a.used) >= 10000 {
		a.mu.Unlock()
		return aiError("busy", "当前请求过多，请等待或重启面板")
	}
	timeout := a.timeout
	if timeout == 0 {
		timeout = 45 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	a.pending[req.RequestID] = cancel
	a.used[req.RequestID] = true
	a.mu.Unlock()
	defer func() { cancel(); a.mu.Lock(); delete(a.pending, req.RequestID); a.mu.Unlock() }()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return aiError("invalid_url", "API 地址无效")
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	if req.APIKey != "" {
		request.Header.Set("Authorization", "Bearer "+req.APIKey)
	}
	transport := &http.Transport{Proxy: nil, ForceAttemptHTTP2: true, TLSHandshakeTimeout: 10 * time.Second, ResponseHeaderTimeout: timeout}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: timeout, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(request)
	if err != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			return aiError("cancelled", "已取消请求")
		}
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return aiError("timeout", "连接超时，请检查地址或稍后重试")
		}
		return aiError("network", "无法连接 API，请检查地址、网络与 TLS 证书")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		switch response.StatusCode {
		case 401, 403:
			return aiError("unauthorized", "API 认证失败，请检查 Key 或访问权限")
		case 429:
			return aiError("rate_limit", "API 请求过于频繁或额度不足，请稍后重试")
		default:
			if response.StatusCode >= 300 && response.StatusCode < 400 {
				return aiError("redirect", "API 返回重定向，已拒绝；请直接填写最终 API 地址")
			}
			return aiError("http_error", "API 返回错误，请检查服务状态与模型名称")
		}
	}
	raw, err := io.ReadAll(io.LimitReader(response.Body, 1024*1024+1))
	if err != nil {
		if errors.Is(ctx.Err(), context.Canceled) {
			return aiError("cancelled", "已取消请求")
		}
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return aiError("timeout", "响应超时，请稍后重试")
		}
		return aiError("network", "读取 API 响应失败，请重试")
	}
	if len(raw) > 1024*1024 {
		return aiError("too_large", "API 响应过大，已拒绝")
	}
	if req.APIKey != "" && strings.Contains(string(raw), req.APIKey) {
		return aiError("sensitive_response", "AI 响应包含当前 API Key，整份响应已拒绝")
	}
	var decoded struct {
		Choices []struct {
			Message struct {
				Content      string          `json:"content"`
				ToolCalls    json.RawMessage `json:"tool_calls"`
				FunctionCall json.RawMessage `json:"function_call"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(raw, &decoded) != nil || len(decoded.Choices) != 1 {
		return aiError("invalid_response", "API 未返回有效的单份文本草案")
	}
	m := decoded.Choices[0].Message
	if (len(m.ToolCalls) > 0 && string(m.ToolCalls) != "null" && string(m.ToolCalls) != "[]") || (len(m.FunctionCall) > 0 && string(m.FunctionCall) != "null") {
		return aiError("tool_calls", "仅接受文本草案，不执行工具调用")
	}
	if strings.TrimSpace(m.Content) == "" {
		return aiError("invalid_response", "API 返回空内容，请调整描述后重试")
	}
	if req.APIKey != "" && strings.Contains(m.Content, req.APIKey) {
		return aiError("sensitive_response", "AI 响应包含当前 API Key，整份响应已拒绝")
	}
	return AIResponse{Content: m.Content}
}
