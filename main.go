package main

import (
	"log"
	"strings"

	"github.com/egoist/mygo"
)

func main() {
	// A new profile keeps the old Electron data intact for explicit export/import.
	mygo.App.SetName("Agent Studio")
	mygo.Bind(Exports{})
	mygo.Bind(NewAI())
	if !mygo.App.RequestSingleInstanceLock() {
		return
	}
	var win *mygo.Window
	mygo.App.OnSecondInstance(func(_ []string, _ string) {
		if win != nil {
			win.Restore()
			win.Focus()
		}
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
			target := strings.TrimPrefix(e.URL, "blob:")
			if !strings.HasPrefix(target, "http://mygo.localhost/") && !strings.HasPrefix(target, "mygo://localhost/") && !(mygo.IsDev() && strings.HasPrefix(target, "http://localhost:5173/")) {
				e.PreventDefault()
			}
		})
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
