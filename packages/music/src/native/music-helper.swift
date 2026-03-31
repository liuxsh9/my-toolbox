#!/usr/bin/env swift
// music-helper.swift — NetEase Cloud Music controller via MediaRemote
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

typealias GetNowPlayingClientFunc = @convention(c) (DispatchQueue, @escaping (Any?) -> Void) -> Void
typealias GetNowPlayingInfoFunc = @convention(c) (DispatchQueue, @escaping (Dictionary<String, Any>?) -> Void) -> Void
typealias SendCommandFunc = @convention(c) (Int, Any?, @escaping (Any?) -> Void) -> Void

let MRMediaRemoteGetNowPlayingClient = loadMRSymbol("MRMediaRemoteGetNowPlayingClient", GetNowPlayingClientFunc.self)
let MRMediaRemoteGetNowPlayingInfo = loadMRSymbol("MRMediaRemoteGetNowPlayingInfo", GetNowPlayingInfoFunc.self)
let MRMediaRemoteSendCommand = loadMRSymbol("MRMediaRemoteSendCommand", SendCommandFunc.self)

// Command IDs
let kMRMediaRemoteCommandPlayPause = 3
let kMRMediaRemoteCommandNextTrack = 4
let kMRMediaRemoteCommandPreviousTrack = 5

// Info keys
let kMRTitle = "kMRMediaRemoteNowPlayingInfoTitle"
let kMRArtist = "kMRMediaRemoteNowPlayingInfoArtist"
let kMRAlbum = "kMRMediaRemoteNowPlayingInfoAlbum"
let kMRDuration = "kMRMediaRemoteNowPlayingInfoDuration"
let kMRElapsed = "kMRMediaRemoteNowPlayingInfoElapsedTime"
let kMRRate = "kMRMediaRemoteNowPlayingInfoPlaybackRate"
let kMRArtworkData = "kMRMediaRemoteNowPlayingInfoArtworkData"

// MARK: - State

var lastOutputHash: String = ""
let neteaseBundleId = "com.netease.163music"

// MARK: - Output

@Sendable func output(_ dict: [String: Any]) {
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
    let group = DispatchGroup()

    var currentBundleId: String? = nil
    var nowPlayingInfo: Dictionary<String, Any>? = nil

    group.enter()
    MRMediaRemoteGetNowPlayingClient(DispatchQueue.global()) { client in
        if let client = client as? AnyObject {
            let sel = Selector(("bundleIdentifier"))
            if client.responds(to: sel) {
                let val = client.perform(sel)
                currentBundleId = val?.takeUnretainedValue() as? String
            }
        }
        group.leave()
    }

    group.enter()
    MRMediaRemoteGetNowPlayingInfo(DispatchQueue.global()) { info in
        nowPlayingInfo = info
        group.leave()
    }

    group.notify(queue: .global()) {
        guard currentBundleId == neteaseBundleId else {
            let hash = "inactive"
            if hash != lastOutputHash {
                lastOutputHash = hash
                output(["type": "nowPlaying", "inactive": true])
            }
            return
        }

        guard let info = nowPlayingInfo else {
            let hash = "no-info"
            if hash != lastOutputHash {
                lastOutputHash = hash
                output(["type": "nowPlaying", "inactive": true])
            }
            return
        }

        let title = info[kMRTitle] as? String ?? ""
        let artist = info[kMRArtist] as? String ?? ""
        let album = info[kMRAlbum] as? String ?? ""
        let duration = info[kMRDuration] as? Double ?? 0
        let elapsed = info[kMRElapsed] as? Double ?? 0
        let rate = info[kMRRate] as? Int ?? 0
        let artworkData = info[kMRArtworkData] as? Data
        let artworkBase64 = artworkData?.base64EncodedString()

        // Hash for change detection (title + rate + rounded elapsed)
        let elapsedRound = Int(elapsed)
        let hash = "\(title)|\(artist)|\(rate)|\(elapsedRound)"

        if hash != lastOutputHash {
            lastOutputHash = hash
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

func sendCommand(_ commandId: Int) {
    MRMediaRemoteSendCommand(commandId, nil as Any?) { _ in
        output(["type": "commandResult", "command": commandId, "success": true])
        // Refresh info after command
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            lastOutputHash = ""
            fetchAndOutput()
        }
    }
}

// MARK: - Open NetEase

func openNetease() {
    let workspace = NSWorkspace.shared
    if let appURL = workspace.urlForApplication(withBundleIdentifier: neteaseBundleId) {
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
                lastOutputHash = ""
                fetchAndOutput()
            case "toggle":
                sendCommand(kMRMediaRemoteCommandPlayPause)
            case "next":
                sendCommand(kMRMediaRemoteCommandNextTrack)
            case "prev":
                sendCommand(kMRMediaRemoteCommandPreviousTrack)
            case "open":
                openNetease()
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
