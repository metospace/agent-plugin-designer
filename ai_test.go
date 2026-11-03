package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testRequest(base string) AIRequest {
	return AIRequest{RequestID: "request-one", BaseURL: base, Model: "local-scripted", APIKey: "fake-session-key", Messages: []AIMessage{{Role: "system", Content: "Draft a graph"}, {Role: "user", Content: "Task only"}}}
}
func TestAICompleteOnlyPostsChosenEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" || r.URL.Path != "/v1/chat/completions" {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer fake-session-key" {
			t.Error("missing auth")
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		encoded, _ := json.Marshal(body)
		if strings.Contains(string(encoded), "fake-session-key") {
			t.Error("key in body")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"choices":[{"message":{"content":"{\"mode\":\"append\"}"}}]}`))
	}))
	defer server.Close()
	a := NewAI()
	response := a.Complete(testRequest(server.URL))
	if response.Content != `{"mode":"append"}` || response.Error != "" {
		t.Fatalf("bad result %+v", response)
	}
	if a.Complete(testRequest(server.URL)).Error != "duplicate_request" {
		t.Error("same id redispatched")
	}
}
func TestAIRejectsURLs(t *testing.T) {
	for _, address := range []string{"file:///etc/passwd", "http://name:secret@localhost/v1", "https://api.example/v1?key=secret", "https://api.example/v1#secret", "http://remote.example/v1", "http://localhost.evil/v1"} {
		if _, err := completionURL(address, false); err == nil {
			t.Errorf("accepted %s", address)
		}
	}
	for _, address := range []string{"http://localhost:1234", "http://127.0.0.1:1234/v1", "http://[::1]:1234/v1/chat/completions", "https://example.test/custom"} {
		if _, err := completionURL(address, false); err != nil {
			t.Errorf("rejected %s", address)
		}
	}
	if _, err := completionURL("http://remote.example/v1", true); err != nil {
		t.Error("explicit HTTP ack rejected")
	}
}
func TestAIFriendlyErrorsAndNoRedirect(t *testing.T) {
	for _, status := range []int{401, 403, 429, 500, 302} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Location", "http://127.0.0.1:1/steal")
			w.WriteHeader(status)
			w.Write([]byte("SECRET RAW BODY fake-session-key"))
		}))
		response := NewAI().Complete(testRequest(server.URL))
		server.Close()
		if response.Error == "" || strings.Contains(response.Message, "SECRET") || strings.Contains(response.Message, "fake-session-key") || response.Content != "" {
			t.Fatalf("unsafe error %+v", response)
		}
	}
}
func TestAIRejectsSecretEchoToolsAndOversize(t *testing.T) {
	bodies := []string{`{"choices":[{"message":{"content":"fake-session-key"}}]}`, `{"choices":[{"message":{"content":"draft","tool_calls":[{"id":"x"}]}}]}`, strings.Repeat("x", 1024*1024+2), `{"choices":[]}`}
	for _, body := range bodies {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(body)) }))
		response := NewAI().Complete(testRequest(server.URL))
		server.Close()
		if response.Error == "" || response.Content != "" {
			t.Fatalf("unsafe response %+v", response)
		}
	}
}
func TestAICancelAndTimeout(t *testing.T) {
	for _, cancel := range []bool{true, false} {
		started := make(chan struct{})
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			close(started)
			select {
			case <-r.Context().Done():
			case <-time.After(time.Second):
			}
		}))
		a := NewAI()
		a.timeout = 80 * time.Millisecond
		if cancel {
			a.timeout = time.Second
		}
		done := make(chan AIResponse, 1)
		go func() { done <- a.Complete(testRequest(server.URL)) }()
		<-started
		if cancel && !a.Cancel("request-one") {
			t.Error("cancel did not find request")
		}
		response := <-done
		server.Close()
		expected := "timeout"
		if cancel {
			expected = "cancelled"
		}
		if response.Error != expected {
			t.Fatalf("wanted %s got %+v", expected, response)
		}
		if a.Cancel("request-one") {
			t.Error("completed request not cleaned")
		}
	}
}
func TestAIKeyCannotAppearInMessages(t *testing.T) {
	req := testRequest("http://127.0.0.1:1")
	req.Messages[1].Content = req.APIKey
	if response := NewAI().Complete(req); response.Error != "sensitive_input" {
		t.Fatalf("unsafe input %+v", response)
	}
}
func TestAICancelBeforeDispatch(t *testing.T) {
	a := NewAI()
	if !a.Cancel("request-one") {
		t.Fatal("queued cancel not accepted")
	}
	response := a.Complete(testRequest("http://127.0.0.1:1"))
	if response.Error != "cancelled" {
		t.Fatalf("queued request was not cancelled %+v", response)
	}
}
func TestAIRejectsKeyInURLOrModel(t *testing.T) {
	for _, inURL := range []bool{true, false} {
		req := testRequest("http://127.0.0.1:1")
		if inURL {
			req.BaseURL += "/" + req.APIKey
		} else {
			req.Model = req.APIKey
		}
		response := NewAI().Complete(req)
		if response.Error != "sensitive_input" {
			t.Fatalf("key escaped auth header %+v", response)
		}
	}
}
