#!/usr/bin/env swift
// monitor.swift — macOS activity monitor for work-hours tracking
// Outputs JSON lines to stdout for Node.js to consume

import Foundation
import IOKit

// MARK: - Date Formatter

let dateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd'T'HH:mm:ssxxx"
    f.locale = Locale(identifier: "en_US_POSIX")
    return f
}()

// MARK: - Idle State

var isIdle = false
let idleThreshold: UInt64 = 300 // seconds

// MARK: - HIDIdleTime

func getHIDIdleTime() -> UInt64? {
    var iterator: io_iterator_t = 0
    let result = IOServiceGetMatchingServices(
        kIOMainPortDefault,
        IOServiceMatching("IOHIDSystem"),
        &iterator
    )
    guard result == KERN_SUCCESS else { return nil }
    defer { IOObjectRelease(iterator) }

    let entry = IOIteratorNext(iterator)
    guard entry != 0 else { return nil }
    defer { IOObjectRelease(entry) }

    var unmanagedDict: Unmanaged<CFMutableDictionary>?
    let kr = IORegistryEntryCreateCFProperties(entry, &unmanagedDict, kCFAllocatorDefault, 0)
    guard kr == KERN_SUCCESS, let dict = unmanagedDict?.takeRetainedValue() as? [String: Any] else {
        return nil
    }

    guard let idleTime = dict["HIDIdleTime"] as? UInt64 else { return nil }
    // HIDIdleTime is in nanoseconds, convert to seconds
    return idleTime / 1_000_000_000
}

// MARK: - Output Helper

func output(type: String) {
    let timestamp = dateFormatter.string(from: Date())
    let json = "{\"type\":\"\(type)\",\"timestamp\":\"\(timestamp)\"}"
    print(json)
    fflush(stdout)
}

// MARK: - Notification Observers

let center = DistributedNotificationCenter.default()

center.addObserver(
    forName: NSNotification.Name("com.apple.screenIsLocked"),
    object: nil,
    queue: .main
) { _ in
    output(type: "screen_lock")
}

center.addObserver(
    forName: NSNotification.Name("com.apple.screenIsUnlocked"),
    object: nil,
    queue: .main
) { _ in
    output(type: "screen_unlock")
}

// MARK: - Idle Polling Timer (every 30 seconds)

Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
    guard let idleSeconds = getHIDIdleTime() else { return }

    if idleSeconds >= idleThreshold && !isIdle {
        isIdle = true
        output(type: "idle_start")
    } else if idleSeconds < idleThreshold && isIdle {
        isIdle = false
        output(type: "idle_end")
    }
}

// MARK: - Initial Event

output(type: "screen_unlock")

// MARK: - Run Forever

RunLoop.current.run()
