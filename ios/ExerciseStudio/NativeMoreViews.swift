import SwiftUI
import Charts
import PhotosUI
import UniformTypeIdentifiers

struct NativeProgress: View {
    @ObservedObject var store: NativeStore
    @State private var weight = 0.0
    @State private var waist = 0.0
    @State private var selectedID = "curl"
    @State private var photo: PhotosPickerItem?
    @State private var photos: [[String: String]] = []
    @State private var date = Date()
    var body: some View {
        NativeShell(store: store, title: "Progress") {
            Form {
                Section("Body weight") {
                    NativeTrendChart(points: store.rule("weight") as? [[String: Any]] ?? [], unit: "kg")
                    Text("Rolling 7-day average of recorded weigh-ins.").font(.caption).foregroundStyle(.secondary)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Weight (kg)", value: $weight, format: .number).keyboardType(.decimalPad)
                    Button("Add weigh-in") {
                        guard weight > 0, weight.isFinite else { return }
                        let d = dayString(date), points = (store.profile["weigh"] as? [[String: Any]] ?? []).filter { $0["d"] as? String != d } + [["d": d, "kg": weight]]
                        store.changeProfile("weigh", points.sorted { ($0["d"] as? String ?? "") < ($1["d"] as? String ?? "") })
                    }
                    ForEach(store.profile["weigh"] as? [[String: Any]] ?? [], id: \.dateID) { point in
                        HStack { Text(point["d"] as? String ?? ""); Spacer(); Text("\((point["kg"] as? Double ?? 0).formatted()) kg") }
                    }.onDelete { indices in var readings = store.profile["weigh"] as? [[String: Any]] ?? []; readings.remove(atOffsets: indices); store.changeProfile("weigh", readings) }
                }
                Section("Strength") {
                    Picker("Exercise", selection: $selectedID) { ForEach(store.exercises) { Text($0.name).tag($0.id) } }
                    NativeTrendChart(points: store.rule("trend", ["id": selectedID]) as? [[String: Any]] ?? [], unit: "")
                    Text("Best recorded load, reps or seconds. No estimated one-rep maximum.").font(.caption).foregroundStyle(.secondary)
                }
                Section("Measurements") {
                    TextField("Waist (cm)", value: $waist, format: .number).keyboardType(.decimalPad)
                    Button("Save waist measurement") {
                        guard waist > 0, waist.isFinite else { return }; let d = dayString(date)
                        var list = store.profile["measures"] as? [[String: Any]] ?? []
                        var record = list.first { $0["d"] as? String == d } ?? ["d": d]; record["waist"] = waist
                        list.removeAll { $0["d"] as? String == d }; list.append(record); store.changeProfile("measures", list)
                    }
                    ForEach(store.profile["measures"] as? [[String: Any]] ?? [], id: \.dateID) { record in
                        VStack(alignment: .leading) { Text(record["d"] as? String ?? ""); Text(record.filter { $0.key != "d" }.sorted { $0.key < $1.key }.map { "\($0.key.capitalized): \($0.value) cm" }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary) }
                    }
                }
                Section("Progress photos") {
                    PhotosPicker("Add photo", selection: $photo, matching: .images)
                    ForEach(photos, id: \.photoID) { record in
                        NativePhoto(store: store, name: record["name"] ?? "", date: record["date"] ?? "")
                    }
                }
            }
        }.task { await loadPhotos() }
        .onChange(of: photo) { _, item in Task {
            guard let data = try? await item?.loadTransferable(type: Data.self), let image = UIImage(data: data), let jpeg = image.jpegData(compressionQuality: 0.8), jpeg.count <= 6 * 1024 * 1024 else { store.message = "Choose a photo smaller than 6 MB."; return }
            do { let (_, response) = try await store.request("api/photos?date=" + dayString(date), method: "POST", body: jpeg, contentType: "image/jpeg"); guard response.statusCode == 200 else { throw URLError(.badServerResponse) }; await loadPhotos() } catch { store.message = "Photo upload failed. Try again when connected." }
        } }
    }
    private func loadPhotos() async { if let (data, response) = try? await store.request("api/photos"), response.statusCode == 200 { photos = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]] ?? [] } }
}
func dayString(_ date: Date) -> String { let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; return formatter.string(from: date) }
extension Dictionary where Key == String, Value == Any { var dateID: String { self["d"] as? String ?? "" } }
extension Dictionary where Key == String, Value == String { var photoID: String { self["name"] ?? "" } }
struct NativePhoto: View {
    @ObservedObject var store: NativeStore; let name: String; let date: String
    @State private var image: UIImage?
    var body: some View { VStack(alignment: .leading) { if let image { Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 300).accessibilityLabel("Progress photo from " + date) }; Text(date).font(.caption) }.task { if let (data, response) = try? await store.request("photos/" + name), response.statusCode == 200 { image = UIImage(data: data) } } }
}
struct NativeTrendChart: View {
    let points: [[String: Any]]; let unit: String
    var body: some View {
        if points.isEmpty { Text("Add readings to see your trend.").foregroundStyle(.secondary) }
        else {
            Chart(Array(points.enumerated()), id: \.offset) { _, point in
                LineMark(x: .value("Date", point["d"] as? String ?? ""), y: .value("Value", point["v"] as? Double ?? 0)).foregroundStyle(studioOrange)
                PointMark(x: .value("Date", point["d"] as? String ?? ""), y: .value("Value", point["v"] as? Double ?? 0)).foregroundStyle(studioOrange)
            }.frame(height: 170).chartYAxisLabel(unit)
        }
    }
}
struct NativeSetup: View {
    @ObservedObject var store: NativeStore
    @AppStorage("keepScreenAwake") private var keepAwake = false
    @State private var db = 0.0
    @State private var address = ""
    @State private var importFile = false
    @State private var restore: [String: Any]?
    @State private var confirmRestore = false
    @State private var customName = ""
    @State private var customNotes = ""
    @State private var customGroup = "arms"
    @State private var customTimed = false
    var body: some View {
        NativeShell(store: store, title: "Setup") {
            Form {
                Section("Goal") {
                    Picker("Goal", selection: stringBinding("goal", "muscle")) { Text("Build muscle").tag("muscle"); Text("Body composition").tag("trim"); Text("Lose weight").tag("lose") }
                    Picker("Experience", selection: stringBinding("experience", "beginner")) { Text("Beginner").tag("beginner"); Text("Experienced").tag("experienced") }
                    Picker("Session length", selection: intBinding("minutes", 45)) { ForEach([15, 20, 30, 45, 60], id: \.self) { Text("\($0) minutes").tag($0) } }
                    TextField("Starting weight (kg)", value: doubleBinding("startKg"), format: .number).keyboardType(.decimalPad)
                    TextField("Target weight (kg)", value: doubleBinding("targetKg"), format: .number).keyboardType(.decimalPad)
                }
                Section("Training days") { ForEach(0..<7) { day in Toggle(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day], isOn: Binding(get: { (store.profile["days"] as? [Int] ?? []).contains(day) }, set: { enabled in var days = store.profile["days"] as? [Int] ?? []; if enabled { days.append(day) } else { days.removeAll { $0 == day } }; if !days.isEmpty { store.changeProfile("days", Array(Set(days)).sorted()) } })) } }
                Section("Equipment") {
                    Toggle("I have dumbbells", isOn: boolBinding("hasDumbbells", true)); Toggle("Sturdy chair or bench", isOn: boolBinding("chair", true)); Toggle("Low-impact exercises", isOn: boolBinding("lowImpact", false))
                    HStack { TextField("Dumbbell kg", value: $db, format: .number).keyboardType(.decimalPad); Button("Add") { if db > 0, db.isFinite { let weights = Set((store.profile["dbs"] as? [Double] ?? []) + [db]); store.changeProfile("dbs", weights.sorted()) } } }
                    ForEach(store.profile["dbs"] as? [Double] ?? [], id: \.self) { weight in HStack { Text("\(weight.formatted()) kg"); Spacer(); Button("Remove") { store.changeProfile("dbs", (store.profile["dbs"] as? [Double] ?? []).filter { $0 != weight }) } } }
                }
                Section("Focus areas") { ForEach(studioGroups, id: \.self) { group in Toggle(groupName(group), isOn: arrayBinding("focus", group)) } }
                Section { NavigationLink("Exercises to leave out") { List(store.exercises) { ex in Toggle(ex.name, isOn: arrayBinding("excluded", ex.id)) }.navigationTitle("Excluded exercises") } }
                Section("Custom exercise") {
                    TextField("Name", text: $customName); Picker("Area", selection: $customGroup) { ForEach(studioGroups, id: \.self) { Text(groupName($0)).tag($0) } }; Toggle("Timed exercise", isOn: $customTimed); TextField("Form notes", text: $customNotes, axis: .vertical)
                    Button("Add exercise") { guard !customName.trimmingCharacters(in: .whitespaces).isEmpty else { return }; var list = store.profile["custom"] as? [[String: Any]] ?? []; list.append(["id": "c_" + UUID().uuidString.replacingOccurrences(of: "-", with: ""), "name": customName, "g": customGroup, "eq": "bw", "timed": customTimed, "notes": customNotes]); store.changeProfile("custom", list); customName = "" }
                }
                Section("Your custom exercises") {
                    ForEach(store.profile["custom"] as? [[String: Any]] ?? [], id: \.customID) { item in Text(item["name"] as? String ?? "Custom exercise") }
                        .onDelete { indices in var list = store.profile["custom"] as? [[String: Any]] ?? []; list.remove(atOffsets: indices); store.changeProfile("custom", list) }
                }
                Section("This iPhone") {
                    Toggle("Keep screen awake", isOn: $keepAwake)
                    TextField("HTTPS app address", text: $address).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                    Button("Save connection") { guard let url = ServerAddress.parse(address) else { store.message = "Enter an HTTPS address without embedded credentials."; return }; if url != store.address { Task { await store.switchServer(url) } } }
                    Button("Reconnect") { Task { await store.connect() } }
                }
                Section("Backup and restore") {
                    Button("Export sets as CSV") { store.exportCSV() }
                    Button("Export device log backup") { store.exportLocal() }
                    Button("Download log + photos archive") { Task { await store.exportServer("api/archive", "exercise-studio-archive.tar.gz") } }
                    Button("Restore log backup") { importFile = true }
                    Text("Backups contain private workout records. A restore replaces server logs; progress photos are restored separately.").font(.caption).foregroundStyle(.secondary)
                }
            }
        }.onAppear { address = store.address.absoluteString }
        .fileImporter(isPresented: $importFile, allowedContentTypes: [.json]) { result in
            do { let url = try result.get(); guard url.startAccessingSecurityScopedResource() else { return }; defer { url.stopAccessingSecurityScopedResource() }; restore = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]; if restore?["days"] != nil { confirmRestore = true } } catch { store.message = "Could not read this backup." }
        }
        .confirmationDialog("Replace all server logs with this backup?", isPresented: $confirmRestore, titleVisibility: .visible) { Button("Replace logs", role: .destructive) { if let restore { Task { await store.restoreBackup(restore) } } } }
    }
    func stringBinding(_ key: String, _ fallback: String) -> Binding<String> { Binding(get: { store.profile[key] as? String ?? fallback }, set: { store.changeProfile(key, $0) }) }
    func intBinding(_ key: String, _ fallback: Int) -> Binding<Int> { Binding(get: { store.profile[key] as? Int ?? fallback }, set: { store.changeProfile(key, $0) }) }
    func doubleBinding(_ key: String) -> Binding<Double> { Binding(get: { store.profile[key] as? Double ?? 0 }, set: { if $0.isFinite { store.changeProfile(key, $0) } }) }
    func boolBinding(_ key: String, _ fallback: Bool) -> Binding<Bool> { Binding(get: { store.profile[key] as? Bool ?? fallback }, set: { store.changeProfile(key, $0) }) }
    func arrayBinding(_ key: String, _ value: String) -> Binding<Bool> { Binding(get: { (store.profile[key] as? [String] ?? []).contains(value) }, set: { enabled in var list = store.profile[key] as? [String] ?? []; list.removeAll { $0 == value }; if enabled { list.append(value) }; store.changeProfile(key, list) }) }
}

extension Dictionary where Key == String, Value == Any { var customID: String { self["id"] as? String ?? "" } }
