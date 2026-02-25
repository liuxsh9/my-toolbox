#!/usr/bin/env swift
// notification-probe.swift
// 探针：监听 macOS 通知横幅，打印能读到的内容
// Usage: swift notification-probe.swift

import Cocoa
import ApplicationServices

// 检查 Accessibility 权限
let trusted = AXIsProcessTrusted()
print("Accessibility trusted: \(trusted)")
if !trusted {
    print("ERROR: Need Accessibility permission. Grant it in System Settings → Privacy & Security → Accessibility")
    exit(1)
}

print("Watching for notification banners... (trigger a notification to test)")
print("Press Ctrl+C to stop\n")

// 找到 NotificationCenter 进程
func findNotificationCenterApp() -> AXUIElement? {
    let apps = NSWorkspace.shared.runningApplications
    for app in apps {
        if app.bundleIdentifier == "com.apple.notificationcenterui" ||
           app.localizedName == "NotificationCenter" {
            return AXUIElementCreateApplication(app.processIdentifier)
        }
    }
    return nil
}

func dumpElement(_ el: AXUIElement, indent: Int = 0) {
    let pad = String(repeating: "  ", count: indent)

    var role: AnyObject?
    var title: AnyObject?
    var value: AnyObject?
    var desc: AnyObject?
    var label: AnyObject?

    AXUIElementCopyAttributeValue(el, kAXRoleAttribute as CFString, &role)
    AXUIElementCopyAttributeValue(el, kAXTitleAttribute as CFString, &title)
    AXUIElementCopyAttributeValue(el, kAXValueAttribute as CFString, &value)
    AXUIElementCopyAttributeValue(el, kAXDescriptionAttribute as CFString, &desc)
    AXUIElementCopyAttributeValue(el, kAXLabelValueAttribute as CFString, &label)

    let roleStr = (role as? String) ?? "?"
    let titleStr = (title as? String).map { "title=\($0)" } ?? ""
    let valueStr = (value as? String).map { "value=\($0)" } ?? ""
    let descStr = (desc as? String).map { "desc=\($0)" } ?? ""

    let info = [titleStr, valueStr, descStr].filter { !$0.isEmpty }.joined(separator: " | ")
    if !info.isEmpty || indent < 2 {
        print("\(pad)[\(roleStr)] \(info)")
    }

    var children: AnyObject?
    AXUIElementCopyAttributeValue(el, kAXChildrenAttribute as CFString, &children)
    if let kids = children as? [AXUIElement] {
        for kid in kids {
            dumpElement(kid, indent: indent + 1)
        }
    }
}

// Poll every second for notification banners
var lastSeen = Set<String>()

func scanBanners() {
    guard let ncApp = findNotificationCenterApp() else { return }

    var windows: AnyObject?
    AXUIElementCopyAttributeValue(ncApp, kAXWindowsAttribute as CFString, &windows)
    guard let wins = windows as? [AXUIElement], !wins.isEmpty else { return }

    for win in wins {
        var winTitle: AnyObject?
        AXUIElementCopyAttributeValue(win, kAXTitleAttribute as CFString, &winTitle)
        let titleStr = (winTitle as? String) ?? ""

        // Collect all text from this window
        var texts: [String] = []
        collectTexts(win, &texts)

        let key = texts.joined(separator: "|")
        if !key.isEmpty && !lastSeen.contains(key) {
            lastSeen.insert(key)
            print("─── Banner detected ───────────────────")
            print("Window title: \(titleStr)")
            print("Texts found:")
            for t in texts { print("  · \(t)") }
            print("Full AX tree:")
            dumpElement(win)
            print("")
        }
    }
}

func collectTexts(_ el: AXUIElement, _ out: inout [String]) {
    for attr in [kAXTitleAttribute, kAXValueAttribute, kAXDescriptionAttribute] as [String] {
        var val: AnyObject?
        AXUIElementCopyAttributeValue(el, attr as CFString, &val)
        if let s = val as? String, !s.isEmpty, !out.contains(s) {
            out.append(s)
        }
    }
    var children: AnyObject?
    AXUIElementCopyAttributeValue(el, kAXChildrenAttribute as CFString, &children)
    if let kids = children as? [AXUIElement] {
        for kid in kids { collectTexts(kid, &out) }
    }
}

// Run loop
let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
    scanBanners()
}

RunLoop.main.run()
