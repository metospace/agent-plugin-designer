package main

import (
 "log"
 "strings"

 "github.com/egoist/mygo"
)

func main() {
 // A new profile keeps the old Electron data intact for explicit export/import.
 mygo.App.SetName("Agent Studio")
 if !mygo.App.RequestSingleInstanceLock() { return }
 var win *mygo.Window
 mygo.App.OnSecondInstance(func(_ []string, _ string) {
  if win != nil { win.Restore(); win.Focus() }
 })
 mygo.App.WhenReady(func() {
  win = mygo.NewWindow(mygo.WindowOptions{
   Title: "Agent Studio · 插件设计器", URL: "/", Width: 1440, Height: 1000,
   MinWidth: 1100, MinHeight: 720, StateKey: "main",
  })
  page := win.Page()
  page.SetPermissionHandler(func(mygo.PermissionRequest) bool { return false })
  page.SetWindowOpenHandler(func(mygo.WindowOpenRequest) *mygo.WindowOptions { return nil })
  page.OnWillNavigate(func(e *mygo.NavigateEvent) {
   if !strings.HasPrefix(e.URL, "http://mygo.localhost/") && !strings.HasPrefix(e.URL, "mygo://localhost/") && !(mygo.IsDev() && strings.HasPrefix(e.URL,"http://localhost:5173/")) { e.PreventDefault() }
  })
  page.OnWillDownload(func(e *mygo.DownloadEvent) {
   path, err := mygo.Dialog.Save(mygo.SaveDialogOptions{Parent: win, Title: "保存 Agent Studio 导出文件", DefaultPath: e.Path})
   if err != nil || path == "" { e.PreventDefault(); return }
   e.Path = path
  })
 })
 if err := mygo.App.Run(); err != nil { log.Fatal(err) }
}
