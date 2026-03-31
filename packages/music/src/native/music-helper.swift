#!/usr/bin/env swift
// music-helper.swift — Music controller via MediaRemote
// Polls now-playing info every 3s, accepts JSON commands on stdin

import Foundation
import AppKit

// MARK: - MediaRemote Framework Loading

let mediaRemotePath = "/System/Library/PrivateFrameworks/MediaRemote.framework/Versions/A/MediaRemote"
guard let mrHandle = dlopen(mediaRemotePath, RTLD_LAZY) else {
    fputs("ERROR: Failed to load MediaRemote framework\n", stderr)
    exit(1)
}

func loadMRSymbol<T>(_ name: String, _ type: T.Type) -> T {
    guard let sym = dlsym(mrHandle, name) else {
        fputs("ERROR: Symbol not found: \(name)\n", stderr)
        exit(1)
    }
    return unsafeBitCast(sym, to: type)
}

// MARK: - MediaRemote Function Declarations

typealias GetNowPlayingInfoFunc = @convention(c) (DispatchQueue, @escaping (Dictionary<String, Any>?) -> Void) -> Void
typealias SendCommandFunc = @convention(c) (Int, Any?, @escaping (Any?) -> Void) -> Void

let MRMediaRemoteGetNowPlayingInfo = loadMRSymbol("MRMediaRemoteGetNowPlayingInfo", GetNowPlayingInfoFunc.self)
let MRMediaRemoteSendCommand = loadMRSymbol("MRMediaRemoteSendCommand", SendCommandFunc.self)

// MARK: - State

var lastHash: String = ""

// MARK: - Output

func output(_ dict: [String: Any]) {
    do {
        let data = try JSONSerialization.data(withJSONObject: dict)
        if let str = String(data: data, encoding: .utf8) {
            print(str)
            fflush(stdout)
        }
    } catch {
        fputs("JSON encode error: \(error)\n", stderr)
    }
}

// MARK: - Get Now Playing Info

func fetchAndOutput() {
    MRMediaRemoteGetNowPlayingInfo(DispatchQueue.main) { info in
        guard let info = info else {
            if lastHash != "none" {
                lastHash = "none"
                output(["type": "nowPlaying", "inactive": true])
            }
            return
        }

        let title = info["kMRMediaRemoteNowPlayingInfoTitle"] as? String ?? ""
        let artist = info["kMRMediaRemoteNowPlayingInfoArtist"] as? String ?? ""
        let album = info["kMRMediaRemoteNowPlayingInfoAlbum"] as? String ?? ""
        let duration = info["kMRMediaRemoteNowPlayingInfoDuration"] as? Double ?? 0
        let elapsed = info["kMRMediaRemoteNowPlayingInfoElapsedTime"] as? Double ?? 0
        let rate = info["kMRMediaRemoteNowPlayingInfoPlaybackRate"] as? Int ?? 0
        let artworkData = info["kMRMediaRemoteNowPlayingInfoArtworkData"] as? Data
        let artworkBase64 = artworkData?.base64EncodedString()

        if title.isEmpty && artist.isEmpty {
            if lastHash != "empty" {
                lastHash = "empty"
                output(["type": "nowPlaying", "inactive": true])
            }
            return
        }

        let hash = "\(title)|\(artist)|\(rate)|\(Int(elapsed))"
        if hash != lastHash {
            lastHash = hash
            output([
                "type": "nowPlaying",
                "title": title,
                "artist": artist,
                "album": album,
                "duration": duration,
                "elapsed": elapsed,
                "rate": rate,
                "artworkBase64": artworkBase64 as Any,
            ] as [String: Any])
        }
    }
}

// MARK: - Send Command

// Toggle uses MediaRemote (no app activation).
// Next/Prev use AppleScript click menu item (no activation).

func sendCommand(_ action: String) {
    switch action {
    case "toggle":
        MRMediaRemoteSendCommand(2, nil) { _ in
            lastHash = ""
            fetchAndOutput()
        }
    case "next":
        clickMenuItem("下一个")
    case "prev":
        clickMenuItem("上一个")
    default:
        break
    }
}

func clickMenuItem(_ itemName: String) {
    let script = """
    tell application "System Events"
        tell process "NeteaseMusic"
            click menu item "\(itemName)" of menu "控制" of menu bar item "控制" of menu bar 1
        end tell
    end tell
    """
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    proc.arguments = ["-e", script]
    do {
        try proc.run()
        proc.waitUntilExit()
    } catch {}
    lastHash = ""
    fetchAndOutput()
}

// MARK: - Open App

func openApp() {
    let bundleId = "com.netease.163music"
    let workspace = NSWorkspace.shared
    if let appURL = workspace.urlForApplication(withBundleIdentifier: bundleId) {
        workspace.openApplication(at: appURL, configuration: NSWorkspace.OpenConfiguration(), completionHandler: nil)
        output(["type": "commandResult", "command": "open", "success": true])
    } else {
        output(["type": "commandResult", "command": "open", "success": false])
    }
}

// MARK: - Stdin Command Reader

func setupStdinReader() {
    let stdinStream = FileHandle.standardInput
    stdinStream.waitForDataInBackgroundAndNotify()

    NotificationCenter.default.addObserver(
        forName: NSNotification.Name.NSFileHandleDataAvailable,
        object: stdinStream,
        queue: .main
    ) { _ in
        let data = stdinStream.availableData
        if data.count == 0 {
            exit(0)
        }
        if let line = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
           let lineData = line.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any],
           let command = json["command"] as? String {

            switch command {
            case "info":
                lastHash = ""
                fetchAndOutput()
            case "toggle":
                sendCommand("toggle")
            case "next":
                sendCommand("next")
            case "prev":
                sendCommand("prev")
            case "open":
                openApp()
            default:
                break
            }
        }

        stdinStream.waitForDataInBackgroundAndNotify()
    }
}

// MARK: - Polling Timer (3s)

Timer.scheduledTimer(withTimeInterval: 3.0, repeats: true) { _ in
    fetchAndOutput()
}

// MARK: - Startup

setupStdinReader()
fetchAndOutput()
RunLoop.current.run()
