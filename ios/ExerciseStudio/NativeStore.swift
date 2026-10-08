import SwiftUI
import JavaScriptCore
import WebKit
import CryptoKit

struct ExerciseProp: Decodable {
    let chairX: Double?; let wall: Double?
    enum CodingKeys: String, CodingKey { case chair, wall }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        wall = try c.decodeIfPresent(Double.self, forKey: .wall)
        if c.contains(.chair) { var chair = try c.nestedUnkeyedContainer(forKey: .chair); chairX = try chair.decode(Double.self) } else { chairX = nil }
    }
}
struct Exercise: Identifiable, Decodable {
    let id: String; let name: String; let g: String; let eq: String
    let steps: [String]; let tip: String
    var prop: ExerciseProp?
    var muscles: [String]?; var unilateral: Bool?; var timed: Int?; var db: Int?; var singleBell: Bool?; var custom: Int?
}
struct NativeFile: Identifiable { let id = UUID(); let url: URL }

@MainActor
final class NativeStore: ObservableObject {
    @Published var profile: [String: Any] = [:]
    @Published var days: [String: Any] = [:]
    @Published var needsSignIn = false
    @Published var message: String?
    @Published var conflicts: [String: [String: Any]] = [:]
    @Published var file: NativeFile?
    @Published var busy = false
    let engine = JSContext()!
    private var revisions: [String: Any] = ["profile": 0, "days": [String: Int]()]
    private var dirty: Set<String> = []
    private var generations: [String: Int] = [:]
    private var flushing = false
    let network: URLSession
    private let cacheRoot: URL?
    private let autoSync: Bool
    var address: URL { ServerAddress.parse(UserDefaults.standard.string(forKey: "serverAddress") ?? "") ?? ServerAddress.defaultURL }
    var today: String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date()) }
    var state: [String: Any] { ["profile": profile, "days": days] }
    var exercises: [Exercise] {
        guard let text = ruleText("library"), let data = text.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([Exercise].self, from: data)) ?? []
    }
    init(cacheRoot: URL? = nil, network: URLSession? = nil, autoSync: Bool = true) {
        self.cacheRoot = cacheRoot; self.network = network ?? URLSession(configuration: .default); self.autoSync = autoSync
        let source = try! String(contentsOf: Bundle.main.url(forResource: "shared-rules", withExtension: "js")!)
        engine.evaluateScript(source)
        profile = json(engine.objectForKeyedSubscript("NativeRules")?.forProperty("defaultProfile")?.call(withArguments: [])?.toString()) as? [String: Any] ?? [:]
        loadCache()
    }
    func ruleText(_ method: String, _ arguments: [String: Any] = [:]) -> String? {
        engine.objectForKeyedSubscript("NativeRules")?.forProperty("run")?.call(withArguments: [state, method, arguments.merging(["date": arguments["date"] ?? today], uniquingKeysWith: { old, _ in old })])?.toString()
    }
    func rule(_ method: String, _ arguments: [String: Any] = [:]) -> Any? { json(ruleText(method, arguments)) }
    func json(_ text: String?) -> Any? { guard let text, let data = text.data(using: .utf8) else { return nil }; return try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) }
    func plan(_ date: String? = nil) -> [String: Any]? { rule("plan", ["date": date ?? today]) as? [String: Any] }
    func day(_ date: String) -> [String: Any] { days[date] as? [String: Any] ?? ["date": date, "entries": [[String: Any]](), "min": 0] }
    func status(_ date: String) -> String { rule("status", ["day": day(date)]) as? String ?? "partial" }
    func count(_ date: String, _ id: String) -> Int { rule("count", ["day": day(date), "id": id]) as? Int ?? 0 }
    func changeProfile(_ key: String, _ value: Any) { profile[key] = value; profile["set"] = true; changed("profile") }
    func saveDay(_ date: String, _ value: [String: Any]) { days[date] = value; changed(date) }
    func changed(_ key: String) { dirty.insert(key); generations[key, default: 0] += 1; persist(); if autoSync { Task { await flush() } } }
    func addSet(_ date: String, _ exercise: Exercise, _ set: [String: Any], plan: [String: Any]? = nil, editIndex: Int? = nil) {
        var d = day(date), entries = d["entries"] as? [[String: Any]] ?? []
        if d["plan"] == nil, let p = plan ?? self.plan(date), (p["ids"] as? [String] ?? []).contains(exercise.id) { d["plan"] = p }
        let i = entries.firstIndex(where: { $0["ex"] as? String == exercise.id }) ?? entries.count
        if i == entries.count { entries.append(["ex": exercise.id, "sets": [[String: Any]]()]) }
        var sets = entries[i]["sets"] as? [[String: Any]] ?? []
        if let editIndex, sets.indices.contains(editIndex) { sets[editIndex] = set } else { sets.append(set) }
        entries[i]["sets"] = sets; d["entries"] = entries; saveDay(date, d)
    }
    func removeSet(_ date: String, _ id: String, _ index: Int) -> [String: Any]? {
        var d = day(date), entries = d["entries"] as? [[String: Any]] ?? []
        guard let i = entries.firstIndex(where: { $0["ex"] as? String == id }), var sets = entries[i]["sets"] as? [[String: Any]], sets.indices.contains(index) else { return nil }
        let set = sets.remove(at: index); entries[i]["sets"] = sets; d["entries"] = entries; saveDay(date, d); return set
    }
    private var cacheURL: URL {
        let name = SHA256.hash(data: Data(address.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
        let dir = cacheRoot ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("studio-" + name + ".json")
    }
    private func loadCache() {
        if let data = try? Data(contentsOf: cacheURL), let c = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            profile = c["profile"] as? [String: Any] ?? profile; days = c["days"] as? [String: Any] ?? [:]
            revisions = c["revisions"] as? [String: Any] ?? revisions; dirty = Set(c["dirty"] as? [String] ?? []); conflicts = c["conflicts"] as? [String: [String: Any]] ?? [:]
        }
    }
    private func persist() {
        do {
            let payload = state.merging(["revisions": revisions, "dirty": Array(dirty), "conflicts": conflicts], uniquingKeysWith: { _, new in new })
            try JSONSerialization.data(withJSONObject: payload).write(to: cacheURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        } catch { message = "Device storage could not save your edits. Keep this app open and export a backup." }
    }
    func copySignInCookies() async {
        let cookies = await WKWebsiteDataStore.default().httpCookieStore.allCookies()
        for cookie in cookies {
            let domain = cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased(), host = address.host?.lowercased() ?? ""
            if host == domain || host.hasSuffix("." + domain) { HTTPCookieStorage.shared.setCookie(cookie) }
        }
    }
    func request(_ route: String, method: String = "GET", body: Data? = nil, contentType: String = "application/json", revision: Int? = nil) async throws -> (Data, HTTPURLResponse) {
        var r = URLRequest(url: URL(string: route, relativeTo: address)!.absoluteURL); r.cachePolicy = .reloadIgnoringLocalCacheData; r.httpMethod = method; r.httpBody = body
        r.setValue(contentType, forHTTPHeaderField: "Content-Type"); if let revision { r.setValue(String(revision), forHTTPHeaderField: "If-Match") }
        let (data, response) = try await network.data(for: r)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        if http.statusCode == 401 || (route.hasPrefix("api/") && http.value(forHTTPHeaderField: "Content-Type")?.contains("text/html") == true) { needsSignIn = true; throw URLError(.userAuthenticationRequired) }
        return (data, http)
    }
    func connect() async {
        busy = true; defer { busy = false }
        await copySignInCookies()
        let generation = generations
        do {
            let (data, http) = try await request("api/state")
            guard http.statusCode == 200, let remote = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw URLError(.badServerResponse) }
            guard generations == generation else { await flush(); return }
            let remoteDays = remote["days"] as? [String: Any] ?? [:], remoteRev = remote["revisions"] as? [String: Any] ?? ["profile": 0, "days": [String: Int]()]
            if !dirty.contains("profile") { profile = remote["profile"] as? [String: Any] ?? profile; revisions["profile"] = remoteRev["profile"] ?? 0 }
            var rv = revisions["days"] as? [String: Int] ?? [:], rrv = remoteRev["days"] as? [String: Int] ?? [:]
            for key in Set(days.keys).union(remoteDays.keys).union(rrv.keys) where !dirty.contains(key) { days[key] = remoteDays[key]; rv[key] = rrv[key] ?? 0 }
            revisions["days"] = rv; needsSignIn = false; message = nil; persist(); await flush()
        } catch { if !needsSignIn { message = "Offline. Your saved library and local records remain available; edits will wait for reconnection." } }
    }
    func flush() async {
        guard !flushing, !needsSignIn else { return }; flushing = true; defer { flushing = false }
        while let key = dirty.sorted().first(where: { conflicts[$0] == nil }) {
            let gen = generations[key, default: 0], body: Any = key == "profile" ? profile : day(key)
            let revision = key == "profile" ? (revisions["profile"] as? Int ?? 0) : ((revisions["days"] as? [String: Int] ?? [:])[key] ?? 0)
            do {
                let (data, response) = try await request(key == "profile" ? "api/profile" : "api/days/" + key, method: "PUT", body: JSONSerialization.data(withJSONObject: body), revision: revision)
                let reply = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
                if response.statusCode == 409 { conflicts[key] = reply; persist(); continue }
                guard response.statusCode == 200, let version = reply["revision"] as? Int else { message = "This edit could not be saved. It remains on this device."; return }
                if key == "profile" { revisions["profile"] = version } else { var rv = revisions["days"] as? [String: Int] ?? [:]; rv[key] = version; revisions["days"] = rv }
                if generations[key, default: 0] == gen { dirty.remove(key) }; message = nil; persist()
            } catch { if !needsSignIn { message = "Offline. Edits are kept on this device until you reconnect." }; return }
        }
    }
    func resolve(_ key: String, keepLocal: Bool) {
        guard let conflict = conflicts[key], let revision = conflict["revision"] as? Int else { return }
        if key == "profile" { revisions["profile"] = revision; if !keepLocal { profile = conflict["current"] as? [String: Any] ?? profile } }
        else { var rv = revisions["days"] as? [String: Int] ?? [:]; rv[key] = revision; revisions["days"] = rv; if !keepLocal { days[key] = conflict["current"] is NSNull ? nil : conflict["current"] } }
        conflicts.removeValue(forKey: key); if !keepLocal { dirty.remove(key) }; persist(); if autoSync { Task { await flush() } }
    }
    func exportLocal() {
        do { let url = FileManager.default.temporaryDirectory.appendingPathComponent("exercise-studio-device-backup.json"); try JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted]).write(to: url); file = NativeFile(url: url) } catch { message = error.localizedDescription }
    }
    func exportServer(_ route: String, _ filename: String) async {
        do { let (data, response) = try await request(route); guard response.statusCode == 200 else { throw URLError(.badServerResponse) }; let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename); try data.write(to: url); file = NativeFile(url: url) } catch { message = "Export failed. " + error.localizedDescription }
    }
    func restoreBackup(_ backup: [String: Any]) async {
        guard dirty.isEmpty, conflicts.isEmpty else { message = "Save or resolve pending edits before restoring."; return }
        do {
            var payload = backup; payload["baseRevisions"] = revisions
            let (_, response) = try await request("api/restore", method: "POST", body: JSONSerialization.data(withJSONObject: payload))
            guard response.statusCode == 200 else { message = "Restore refused. Reconnect to review current server changes before retrying."; return }
            await connect()
        } catch { message = "Restore failed. Your current records remain available." }
    }

    func switchServer(_ url: URL) async {
        guard dirty.isEmpty, !flushing, !busy else { message = "Reconnect and save or resolve pending edits before changing servers."; return }
        UserDefaults.standard.set(url.absoluteString, forKey: "serverAddress")
        profile = json(engine.objectForKeyedSubscript("NativeRules")?.forProperty("defaultProfile")?.call(withArguments: [])?.toString()) as? [String: Any] ?? [:]
        days = [:]; revisions = ["profile": 0, "days": [String: Int]()]; conflicts = [:]; generations = [:]
        loadCache(); await connect()
    }

    func exportCSV() {
        func escaped(_ value: String) -> String { "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\"" }
        var rows = ["date,exercise,set,reps,kg,seconds,side"]
        for date in days.keys.sorted() {
            for entry in day(date)["entries"] as? [[String: Any]] ?? [] {
                let id = entry["ex"] as? String ?? "", name = exercises.first { $0.id == id }?.name ?? id
                for (i, set) in (entry["sets"] as? [[String: Any]] ?? []).enumerated() {
                    rows.append([date,name,String(i+1),set["r"].map { String(describing:$0) } ?? "",set["kg"].map { String(describing:$0) } ?? "",set["s"].map { String(describing:$0) } ?? "",set["side"] as? String ?? ""].map(escaped).joined(separator:","))
                }
            }
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("exercise-studio-sets.csv")
        do { try rows.joined(separator:"\n").write(to:url,atomically:true,encoding:.utf8); file = NativeFile(url:url) } catch { message = error.localizedDescription }
    }

}
