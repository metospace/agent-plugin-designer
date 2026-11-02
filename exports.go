package main

import (
	"encoding/base64"
	"errors"
	"log"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/egoist/mygo"
)

// Exports exposes one user-directed save operation, never arbitrary path access.
// Bound methods run on their own goroutines, so the native dialog does not run
// inside WebView2's synchronous DownloadStarting callback.
type Exports struct{}

func (Exports) Save(name, encoded string) (bool, error) {
	debug := os.Getenv("AGENT_STUDIO_DEBUG") == "1"
	if debug {
		log.Printf("Export service called: bytes=%d", len(encoded))
	}
	if len(encoded) > 70_000_000 {
		return false, errors.New("导出文件超过 50 MB")
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return false, errors.New("导出数据无效")
	}
	name = filepath.Base(strings.ReplaceAll(name, `\`, "/"))
	if name != "PLUGIN.md" && name != "agent-plugin.zip" && !strings.HasSuffix(name, ".agent-project.json") {
		return false, errors.New("不支持的导出类型")
	}
	name = strings.Map(func(r rune) rune {
		if r < 32 || strings.ContainsRune(`<>:"/\|?*`, r) {
			return '_'
		}
		return r
	}, name)
	if utf8.RuneCountInString(name) > 160 {
		name = string([]rune(name)[:120]) + ".agent-project.json"
	}
	dir, err := mygo.App.Path(mygo.PathDownloads)
	if err != nil {
		return false, err
	}
	path, err := mygo.Dialog.Save(mygo.SaveDialogOptions{Parent: mygo.FocusedWindow(), Title: "保存 Agent Studio 导出文件", DefaultPath: filepath.Join(dir, name)})
	if debug {
		log.Printf("Native save returned: selected=%t error=%v", path != "", err)
	}
	if err != nil || path == "" {
		return false, err
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		return false, err
	}
	return true, nil
}
