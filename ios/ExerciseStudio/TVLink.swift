import Foundation
import Network
import CryptoKit
import Combine
import UIKit

/// Local, encrypted, read-only workout display. No photos, profile or server credentials leave the phone.
@MainActor
final class TVLink: ObservableObject {
    @Published var lastReceived = Date.distantPast
    @Published var code = ""
    @Published var status = "Not connected"
    @Published var snapshot: [String:Any] = [:]
    @Published var devices: [NWBrowser.Result] = []
    var port: NWEndpoint.Port? { listener?.port }
    private var listener: NWListener?
    private var browser: NWBrowser?
    private var connections: [NWConnection] = []
    private var key: SymmetricKey?
    private var generation = UUID()
    private var connected = false
    private var buffer = Data()
    private var failures = 0
    private var sendSequence = 0
    private var receiveSequence = -1
    private var latest: [String:Any] = [:]
    func host() {
        stop()
        let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        code = String((0..<12).map { _ in alphabet.randomElement()! })
        key = makeKey(code); failures = 0
        do {
            let listener = try NWListener(using:.tcp)
            listener.service = NWListener.Service(name:UIDevice.current.name + " · Exercise Studio",type:"_exercisestudio._tcp")
            let token = generation
            listener.newConnectionHandler = { [weak self] connection in Task { @MainActor in
                guard let self, self.generation == token, self.connections.count < 1 else { connection.cancel(); return }
                self.buffer = Data(); self.sendSequence = 0; self.receiveSequence = -1; self.connections.append(connection); self.prepare(connection, host:true)
            } }
            listener.stateUpdateHandler = { [weak self] state in Task { @MainActor in
                guard let self,self.generation == token else { return }
                if case .ready = state { self.status = "Enter this code on Apple TV" }
                if case .failed = state { self.status = "Local connection unavailable. Check Local Network permission." }
            } }
            self.listener = listener; listener.start(queue:.main)
        } catch { status = "Could not start TV connection" }
    }
    func browse() {
        stop()
        let browser = NWBrowser(for:.bonjour(type:"_exercisestudio._tcp",domain:nil),using:.tcp)
        let token = generation
        browser.browseResultsChangedHandler = { [weak self] results,_ in Task { @MainActor in
            guard let self,self.generation == token else { return }; self.devices = Array(results)
        } }
        browser.stateUpdateHandler = { [weak self] state in Task { @MainActor in
            guard let self,self.generation == token else { return }; if case .failed = state { self.status = "Enable Local Network access to find your iPhone" }
        } }
        self.browser = browser; browser.start(queue:.main); status = "Open TV mode on your iPhone"
    }
    func join(_ endpoint:NWEndpoint, code:String) {
        let normalized = code.uppercased().filter { $0.isLetter || $0.isNumber }
        guard normalized.count == 12 else { status = "Enter the 12-character code from your iPhone"; return }
        connections.forEach { $0.cancel() }; connections = []; buffer = Data(); sendSequence = 0; receiveSequence = -1; connected = false
        key = makeKey(normalized)
        let connection = NWConnection(to:endpoint,using:.tcp); connections = [connection]; prepare(connection,host:false)
    }
    func publish(_ value:[String:Any]) {
        latest = value
        if connected, let connection = connections.first { send(value,on:connection) }
    }
    func stop() {
        generation = UUID(); listener?.cancel(); browser?.cancel(); connections.forEach { $0.cancel() }
        listener = nil; browser = nil; connections = []; devices = []; key = nil; buffer = Data(); sendSequence = 0; receiveSequence = -1; connected = false; snapshot = [:]; status = "Not connected"; code = ""
    }
    private func makeKey(_ code:String) -> SymmetricKey { SymmetricKey(data:SHA256.hash(data:Data(("ExerciseStudioTV-v1:"+code).utf8))) }
    private func prepare(_ connection:NWConnection,host:Bool) {
        let token = generation
        connection.stateUpdateHandler = { [weak self,weak connection] state in Task { @MainActor in
            guard let self,let connection,self.generation == token else { return }
            switch state {
            case .ready:
                self.status = "Pairing…"; self.receive(connection,host:host,token:token)
                if !host { self.send(["hello":true],on:connection) }
            case .failed, .cancelled:
                self.connections.removeAll {$0 === connection}; self.connected = false
                self.status = host ? "Enter this code on Apple TV" : "Disconnected · reconnect from the list"
            default: break
            }
        } }
        connection.start(queue:.main)
        Task { [weak self,weak connection] in
            try? await Task.sleep(for:.seconds(10))
            guard let self,self.generation == token,!self.connected else { return }; connection?.cancel()
        }
    }
    private func send(_ value:[String:Any],on connection:NWConnection) {
        var payload = value; payload["_sequence"] = sendSequence; sendSequence += 1
        guard let key,let data = try? JSONSerialization.data(withJSONObject:payload),data.count < 65536,
              let encrypted = try? AES.GCM.seal(data,using:key).combined else { return }
        var size = UInt32(encrypted.count).bigEndian
        var frame = withUnsafeBytes(of:&size) { Data($0) }; frame.append(encrypted)
        connection.send(content:frame,completion:.contentProcessed { _ in })
    }
    private func receive(_ connection:NWConnection,host:Bool,token:UUID) {
        connection.receive(minimumIncompleteLength:1,maximumLength:65536) { [weak self,weak connection] data,_,complete,error in Task { @MainActor in
            guard let self,let connection,self.generation == token else { return }
            if let data { self.buffer.append(data) }
            while self.buffer.count >= 4 {
                let length = self.buffer.prefix(4).reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
                guard length > 0,length <= 65564 else { connection.cancel(); return }
                guard self.buffer.count >= Int(length)+4 else { break }
                let encrypted = self.buffer.subdata(in:4..<(Int(length)+4)); self.buffer.removeFirst(Int(length)+4)
                guard let key = self.key,let box = try? AES.GCM.SealedBox(combined:encrypted),let clear = try? AES.GCM.open(box,using:key),let value = try? JSONSerialization.jsonObject(with:clear) as? [String:Any] else {
                    self.failures += 1; connection.cancel(); if host && self.failures >= 5 { self.stop(); self.status = "Pairing stopped after repeated incorrect codes. Start TV mode again." }; return
                }
                guard let sequence = value["_sequence"] as? Int, sequence > self.receiveSequence else { continue }
                self.receiveSequence = sequence
                if host {
                    guard value["hello"] as? Bool == true else { connection.cancel(); return }
                    self.connected = true; self.status = "Connected to Apple TV"; self.send(self.latest,on:connection)
                } else { self.connected = true; self.status = "Connected to iPhone"; self.snapshot = value; self.lastReceived = Date() }
            }
            if complete || error != nil { connection.cancel(); return }
            self.receive(connection,host:host,token:token)
        } }
    }
}
