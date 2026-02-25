#!/usr/bin/env swift
// banner-watcher.swift
// Watches macOS notification banners via AX API and forwards them to the notifications service.
// Usage: swift banner-watcher.swift [--url http://localhost:3004]

import Cocoa
import ApplicationServices

// ── Config ──────────────────────────────────────────────────────────────────
var notificationsURL = "http://localhost:3004"
var args = CommandLine.arguments.dropFirst()
while let arg = args.first {
    if arg == "--url", let url = args.dropFirst().first {
        notificationsURL = url
        args = args.dropFirst(2)
    } else {
        args = args.dropFirst()
    }
}

// ── Permission check ─────────────────────────────────────────────────────────
guard AXIsProcessTrusted() else {
    fputs("ERROR: Accessibility permission required.\n", stderr)
    fputs("Grant it in System Settings → Privacy & Security → Accessibility\n", stderr)
    exit(1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
func findNCApp() -> AXUIElement? {
    for app in NSWorkspace.shared.runningApplications {
        if app.bundleIdentifier == "com.apple.notificationcenterui" {
            return AXUIElementCreateApplication(app.processIdentifier)
        }
    }
    return nil
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

// Titles to ignore — system UI elements and persistent widgets, not real notifications
let blocklist: Set<String> = ["编辑小组件", "Edit Widgets", "Notification Center", "天气", "天气预报", "日历", "月"]

func parseBanner(_ texts: [String]) -> (title: String, body: String, source: String)? {
    let content = texts.filter { !blocklist.contains($0) }
    guard content.count >= 2 else { return nil }

    let title = content[content.count - 2]
    let body = content[content.count - 1]

    // Source: try to extract app name from the combined string
    // combined looks like "AppName Title, Body" or just "Title, Body"
    var source = "System"
    if let combined = content.first, combined != title {
        // Strip ", Body" suffix
        var prefix = combined
        if prefix.hasSuffix(", \(body)") {
            prefix = String(prefix.dropLast(", \(body)".count))
        } else if prefix.hasSuffix(body) {
            prefix = String(prefix.dropLast(body.count)).trimmingCharacters(in: .whitespaces)
        }
        // Strip title suffix
        if prefix.hasSuffix(title) {
            prefix = String(prefix.dropLast(title.count)).trimmingCharacters(in: .whitespaces)
        }
        // Remove trailing comma/space
        prefix = prefix.trimmingCharacters(in: CharacterSet(charactersIn: ", ").union(.whitespaces))
        if !prefix.isEmpty { source = prefix }
    }

    return (title: title, body: body, source: source)
}

func pushNotification(title: String, body: String, source: String) {
    guard let url = URL(string: "\(notificationsURL)/api/notifications") else { return }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let payload: [String: String] = ["title": title, "body": body, "source": source]
    req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
    URLSession.shared.dataTask(with: req).resume()
}

// ── Main loop ────────────────────────────────────────────────────────────────
print("banner-watcher started → \(notificationsURL)")
fflush(stdout)

var seen = Set<String>()

Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
    guard let nc = findNCApp() else { return }
    var wins: AnyObject?
    AXUIElementCopyAttributeValue(nc, kAXWindowsAttribute as CFString, &wins)
    guard let ws = wins as? [AXUIElement] else { return }

    for w in ws {
        var texts: [String] = []
        collectTexts(w, &texts)
        let key = texts.joined(separator: "|")
        guard !key.isEmpty, !seen.contains(key) else { continue }
        seen.insert(key)

        if let parsed = parseBanner(texts) {
            // Skip blocklisted titles (persistent widgets, system UI)
            guard !blocklist.contains(parsed.title) else { continue }
            print("→ [\(parsed.source)] \(parsed.title): \(parsed.body)")
            fflush(stdout)
            pushNotification(title: parsed.title, body: parsed.body, source: parsed.source)
        }
    }
}

RunLoop.main.run()
