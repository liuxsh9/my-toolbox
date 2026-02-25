#!/usr/bin/env swift
// windows.swift — macOS window enumeration, focus, and permission checks
// Usage:
//   swift windows.swift list
//   swift windows.swift focus <wid> <pid> <title>
//   swift windows.swift check-permissions

import Cocoa
import CoreGraphics
import ApplicationServices

// ─────────────────────────────────────────────
// MARK: Private CGS APIs for cross-Space window management
// ─────────────────────────────────────────────

@_silgen_name("CGSDefaultConnectionForThread")
func CGSDefaultConnectionForThread() -> Int32

@_silgen_name("CGSGetActiveSpace")
func CGSGetActiveSpace(_ cid: Int32) -> UInt64

// selector: 0x7 = all spaces (user + fullscreen + system)
@_silgen_name("CGSCopySpacesForWindows")
func CGSCopySpacesForWindows(_ cid: Int32, _ selector: Int32, _ wids: CFArray) -> CFArray

@_silgen_name("CGSManagedDisplaySetCurrentSpace")
func CGSManagedDisplaySetCurrentSpace(_ cid: Int32, _ display: CFString, _ sid: UInt64)

@_silgen_name("CGSMainDisplayID")
func CGSMainDisplayID() -> UInt32

let args = CommandLine.arguments

guard args.count >= 2 else {
    fputs("Usage: swift windows.swift <list|focus|check-permissions> [...args]\n", stderr)
    exit(1)
}

// ─────────────────────────────────────────────
// MARK: list
// ─────────────────────────────────────────────

func listWindows() {
    // Only include windows belonging to regular (user-facing) apps
    let regularPIDs = Set(
        NSWorkspace.shared.runningApplications
            .filter { $0.activationPolicy == .regular }
            .map { $0.processIdentifier }
    )

    // .optionAll includes windows on all Spaces and minimized windows
    let options: CGWindowListOption = [.optionAll, .excludeDesktopElements]
    guard let list = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
        print("[]")
        return
    }

    var result: [[String: Any]] = []
    for win in list {
        // Filter: only normal app windows (layer == 0)
        guard let layer = win[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
        // Filter: must have an owner PID belonging to a regular user-facing app
        guard let pid = win[kCGWindowOwnerPID as String] as? Int32,
              regularPIDs.contains(pid) else { continue }
        let title = win[kCGWindowName as String] as? String ?? ""
        let appName = win[kCGWindowOwnerName as String] as? String ?? ""
        guard let wid = win[kCGWindowNumber as String] as? Int else { continue }

        // Extract bounds
        var x = 0, y = 0, width = 0, height = 0
        if let boundsDict = win[kCGWindowBounds as String] as? [String: Any] {
            x = Int(boundsDict["X"] as? CGFloat ?? 0)
            y = Int(boundsDict["Y"] as? CGFloat ?? 0)
            width = Int(boundsDict["Width"] as? CGFloat ?? 0)
            height = Int(boundsDict["Height"] as? CGFloat ?? 0)
        }

        // Skip zero-size windows (system/background elements)
        guard width > 0, height > 0 else { continue }

        // kCGWindowIsOnscreen: false for minimized or windows on other Spaces
        let onScreen = win[kCGWindowIsOnscreen as String] as? Bool ?? false

        result.append([
            "id": wid,
            "title": title,
            "app": appName,
            "pid": Int(pid),
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "onScreen": onScreen,
        ])
    }

    // Deduplicate per PID:
    // - Keep all titled windows (on-screen or off-screen)
    // - Untitled on-screen: only keep if the PID has NO titled windows at all
    //   (e.g. app running without Screen Recording) — keep only the largest one
    // - Untitled off-screen: always drop (internal background panels)
    struct WinEntry {
        var entry: [String: Any]
        var titled: Bool
        var onScreen: Bool
        var area: Int
    }

    var byPid: [Int: [WinEntry]] = [:]
    for entry in result {
        guard let pid = entry["pid"] as? Int else { continue }
        let title = entry["title"] as? String ?? ""
        let onScreen = entry["onScreen"] as? Bool ?? false
        let area = (entry["width"] as? Int ?? 0) * (entry["height"] as? Int ?? 0)
        byPid[pid, default: []].append(WinEntry(entry: entry, titled: !title.isEmpty, onScreen: onScreen, area: area))
    }

    var deduped: [[String: Any]] = []
    for (_, windows) in byPid {
        let titled = windows.filter { $0.titled }
        if !titled.isEmpty {
            // Has titled windows — deduplicate by title, prefer on-screen then largest
            var byTitle: [String: WinEntry] = [:]
            for win in titled {
                let t = win.entry["title"] as? String ?? ""
                if let existing = byTitle[t] {
                    let preferNew = (!existing.onScreen && win.onScreen) ||
                                    (existing.onScreen == win.onScreen && win.area > existing.area)
                    if preferNew { byTitle[t] = win }
                } else {
                    byTitle[t] = win
                }
            }
            deduped.append(contentsOf: byTitle.values.map { $0.entry })
        } else {
            // No titled windows (no Screen Recording) — keep largest on-screen only
            if let largest = windows.filter({ $0.onScreen }).max(by: { $0.area < $1.area }) {
                deduped.append(largest.entry)
            }
        }
    }
    result = deduped

    if let data = try? JSONSerialization.data(withJSONObject: result, options: []),
       let json = String(data: data, encoding: .utf8) {
        print(json)
    } else {
        print("[]")
    }
}

// ─────────────────────────────────────────────
// MARK: focus
// ─────────────────────────────────────────────

func focusWindow(wid: Int32, pid: Int32, title: String) {
    guard AXIsProcessTrusted() else {
        // No accessibility — fall back to plain activate (best effort)
        if let app = NSRunningApplication(processIdentifier: pid) {
            app.activate(options: .activateIgnoringOtherApps)
        }
        print("{\"ok\":true,\"degraded\":true,\"reason\":\"no_accessibility\"}")
        return
    }

    let axApp = AXUIElementCreateApplication(pid)
    var windowsRef: AnyObject?
    let result = AXUIElementCopyAttributeValue(axApp, kAXWindowsAttribute as CFString, &windowsRef)

    guard result == .success, let windows = windowsRef as? [AXUIElement] else {
        // AX not ready yet — activate and hope for the best
        if let app = NSRunningApplication(processIdentifier: pid) {
            app.activate(options: .activateIgnoringOtherApps)
        }
        print("{\"ok\":true,\"degraded\":true,\"reason\":\"no_ax_windows\"}")
        return
    }

    // Find matching window by title first, then raise BEFORE activating the app.
    // This prevents macOS from bringing the wrong window to front on activate().
    var matched = false
    for window in windows {
        var titleRef: AnyObject?
        AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)
        let winTitle = titleRef as? String ?? ""

        if winTitle == title || (title.isEmpty && !matched) {
            AXUIElementPerformAction(window, kAXRaiseAction as CFString)
            AXUIElementSetAttributeValue(window, kAXMainAttribute as CFString, kCFBooleanTrue)
            AXUIElementSetAttributeValue(window, kAXFocusedAttribute as CFString, kCFBooleanTrue)
            matched = true
            break
        }
    }

    if !matched, let first = windows.first {
        AXUIElementPerformAction(first, kAXRaiseAction as CFString)
        AXUIElementSetAttributeValue(first, kAXMainAttribute as CFString, kCFBooleanTrue)
    }

    // Activate AFTER raising the specific window
    if let app = NSRunningApplication(processIdentifier: pid) {
        app.activate(options: .activateIgnoringOtherApps)
    }

    if matched {
        print("{\"ok\":true}")
    } else {
        print("{\"ok\":true,\"degraded\":true,\"reason\":\"title_not_matched\"}")
    }
}

// ─────────────────────────────────────────────
// MARK: focus-by-cwd
// ─────────────────────────────────────────────

/// Walk ppid chain from `pid` to find the first ancestor that is a regular
/// user-facing app (activationPolicy == .regular), then ask that app to open
/// `cwd` via NSWorkspace — this reliably focuses the right project window in
/// VS Code, Cursor, Zed, etc. without needing AX window enumeration.
func focusByCwd(pid: Int32, cwd: String) {
    var current = pid
    var targetApp: NSRunningApplication? = nil

    for _ in 0..<12 {
        // Get parent pid
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, current]
        sysctl(&mib, 4, &info, &size, nil, 0)
        let ppid = info.kp_eproc.e_ppid
        if ppid <= 1 { break }

        if let app = NSRunningApplication(processIdentifier: ppid),
           app.activationPolicy == .regular {
            targetApp = app
            break
        }
        current = ppid
    }

    guard let app = targetApp, let bundleURL = app.bundleURL else {
        print("{\"ok\":false,\"error\":\"no_app_found\"}")
        return
    }

    let cwdURL = URL(fileURLWithPath: cwd, isDirectory: true)
    let config = NSWorkspace.OpenConfiguration()
    config.activates = true

    NSWorkspace.shared.open([cwdURL], withApplicationAt: bundleURL, configuration: config) { _, err in
        if let err = err {
            print("{\"ok\":false,\"error\":\"\(err.localizedDescription)\"}")
        } else {
            print("{\"ok\":true}")
        }
        exit(0)
    }

    // Run loop needed for async completion handler
    RunLoop.main.run(until: Date(timeIntervalSinceNow: 5))
    print("{\"ok\":false,\"error\":\"timeout\"}")
}


/// If the window is already on the current Space, this is a no-op.
func switchToWindowSpace(wid: Int32) {
    let cid = CGSDefaultConnectionForThread()
    let currentSpace = CGSGetActiveSpace(cid)
    let widArray = [NSNumber(value: wid)] as CFArray
    let windowSpaces = CGSCopySpacesForWindows(cid, 0x7, widArray) as? [UInt64] ?? []

    // Already on current space or can't determine — skip
    guard let targetSpace = windowSpaces.first, targetSpace != currentSpace else {
        return
    }

    // Get main display UUID for CGSManagedDisplaySetCurrentSpace
    let mainDisplay = CGSMainDisplayID()
    let uuid = CGDisplayCreateUUIDFromDisplayID(mainDisplay).takeRetainedValue()
    let uuidStr = CFUUIDCreateString(nil, uuid) as CFString

    CGSManagedDisplaySetCurrentSpace(cid, uuidStr, targetSpace)
    usleep(300_000) // 300ms for space transition animation
}

// ─────────────────────────────────────────────
// MARK: check-permissions
// ─────────────────────────────────────────────

func checkPermissions() {
    let accessibility = AXIsProcessTrusted()

    // Screen Recording detection on macOS 15+:
    // When Screen Recording is NOT granted, CGWindowListCopyWindowInfo still returns
    // windows but kCGWindowName is nil for all of them (titles are hidden by the OS).
    // When it IS granted, at least some normal windows will have non-empty titles.
    var screenRecording = false
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    if let list = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] {
        // If any layer-0 window has a non-empty title, Screen Recording is granted
        screenRecording = list.contains { win in
            guard let layer = win[kCGWindowLayer as String] as? Int, layer == 0 else { return false }
            guard let name = win[kCGWindowName as String] as? String, !name.isEmpty else { return false }
            return true
        }
    }

    print("{\"accessibility\":\(accessibility),\"screenRecording\":\(screenRecording)}")
}

// ─────────────────────────────────────────────
// MARK: dispatch
// ─────────────────────────────────────────────

switch args[1] {
case "list":
    listWindows()

case "focus":
    guard args.count >= 5,
          let wid = Int32(args[2]),
          let pid = Int32(args[3]) else {
        fputs("Usage: swift windows.swift focus <wid> <pid> <title>\n", stderr)
        exit(1)
    }
    let title = args[4...].joined(separator: " ")
    focusWindow(wid: wid, pid: pid, title: title)

case "check-permissions":
    checkPermissions()

case "focus-by-cwd":
    guard args.count >= 4,
          let pid = Int32(args[2]) else {
        fputs("Usage: swift windows.swift focus-by-cwd <pid> <cwd>\n", stderr)
        exit(1)
    }
    let cwd = args[3...].joined(separator: " ")
    focusByCwd(pid: pid, cwd: cwd)

default:
    fputs("Unknown command: \(args[1])\n", stderr)
    exit(1)
}
