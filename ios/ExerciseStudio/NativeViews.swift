import SwiftUI
import Charts
import PhotosUI
import UniformTypeIdentifiers

let studioGroups = ["chest", "back", "shoulders", "arms", "core", "legs", "cardio"]
func groupName(_ key: String) -> String { ["chest":"Chest", "back":"Back", "shoulders":"Shoulders", "arms":"Arms", "core":"Core", "legs":"Legs & glutes", "cardio":"Cardio"][key] ?? key.capitalized }
let studioOrange = Color(red: 1, green: 0.36, blue: 0.1)
let studioPaper = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 10/255, green: 18/255, blue: 48/255, alpha: 1) : UIColor(red: 237/255, green: 241/255, blue: 244/255, alpha: 1) })
func setLabel(_ set: [String: Any]) -> String {
    let seconds = set["s"] as? Int ?? 0, reps = set["r"] as? Int ?? 0, kg = set["kg"] as? Double ?? 0
    return (seconds > 0 ? "\(seconds) sec" : "\(reps) reps" + (kg > 0 ? " · \(kg.formatted()) kg" : "")) + ((set["side"] as? String).map { " · " + $0.capitalized } ?? "")
}

struct NativeRootView: View {
    @StateObject private var store = NativeStore()
    @Environment(\.scenePhase) private var phase
    @AppStorage("keepScreenAwake") private var keepAwake = false
    private var offlineUITest: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-nativeUITestOffline")
        #else
        false
        #endif
    }
    var body: some View {
        TabView {
            NativeToday(store: store).tabItem { Label("Today", systemImage: "house") }
            NativeLibrary(store: store).tabItem { Label("Library", systemImage: "dumbbell") }
            NativeHistory(store: store).tabItem { Label("History", systemImage: "calendar") }
            NativeProgress(store: store).tabItem { Label("Progress", systemImage: "chart.xyaxis.line") }
            NativeSetup(store: store).tabItem { Label("Setup", systemImage: "slider.horizontal.3") }
        }
        .tint(studioOrange)
        .sheet(isPresented: $store.needsSignIn) { NativeSignIn(store: store).ignoresSafeArea(edges: .bottom) }
        .sheet(item: $store.file) { FileShareView(url: $0.url) }
        .task { if !offlineUITest { await store.connect() } }
        .onAppear { UIApplication.shared.isIdleTimerDisabled = keepAwake && phase == .active }
        .onChange(of: phase) { _, value in
            UIApplication.shared.isIdleTimerDisabled = keepAwake && value == .active
            if value == .active && !offlineUITest { Task { await store.connect() } }
        }
        .onChange(of: keepAwake) { _, value in UIApplication.shared.isIdleTimerDisabled = value && phase == .active }
    }
}

struct NativeShell<Content: View>: View {
    @ObservedObject var store: NativeStore
    let title: String
    @ViewBuilder let content: Content
    var body: some View {
        NavigationStack {
            content
                .background(studioPaper)
                .navigationTitle(title)
                .toolbarBackground(studioPaper, for: .navigationBar)
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbarBackground(studioPaper, for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
                .safeAreaInset(edge: .top, spacing: 0) {
                    if let message = store.message {
                        HStack { Text(message).font(.caption); Spacer(); Button("Retry") { Task { await store.connect() } } }.padding(12).background(.regularMaterial)
                    }
                    if !store.conflicts.isEmpty {
                        ForEach(store.conflicts.keys.sorted(), id: \.self) { key in NativeConflict(store: store, key: key) }
                    }
                }
        }
    }
}
struct NativeConflict: View {
    @ObservedObject var store: NativeStore; let key: String
    @State private var confirm = false
    var body: some View {
        VStack(alignment: .leading) {
            Text("\(key == "profile" ? "Setup" : key) changed on another device").font(.headline)
            HStack {
                Button("Export both") {
                    let payload: [String: Any] = ["device": key == "profile" ? store.profile : store.day(key), "server": store.conflicts[key] ?? [:]]
                    if let data = try? JSONSerialization.data(withJSONObject: payload, options: .prettyPrinted) {
                        let url = FileManager.default.temporaryDirectory.appendingPathComponent("exercise-conflict.json"); try? data.write(to: url); store.file = NativeFile(url: url)
                    }
                }
                Button("Use server") { store.resolve(key, keepLocal: false) }
                Button("Keep mine") { confirm = true }
            }.font(.caption)
        }.padding().background(Color.orange.opacity(0.18))
        .confirmationDialog("Replace the server version with this device's edits?", isPresented: $confirm, titleVisibility: .visible) { Button("Keep my version", role: .destructive) { store.resolve(key, keepLocal: true) } }
    }
}
struct NativeToday: View {
    @ObservedObject var store: NativeStore
    @State private var selected: Exercise?
    @State private var player: NativeWorkout?
    var body: some View {
        let plan = store.plan()
        NativeShell(store: store, title: "Exercise Studio") {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text(Date.now.formatted(date: .complete, time: .omitted)).font(.subheadline).foregroundStyle(.secondary)
                    if let plan {
                        Text(plan["name"] as? String ?? "Today's workout").font(.largeTitle.bold())
                        Text("\(plan["sets"] as? Int ?? 2) sets per exercise · \((plan["scheme"] as? [String: Any])?["lo"] as? Int ?? 8)–\((plan["scheme"] as? [String: Any])?["hi"] as? Int ?? 12) reps").foregroundStyle(.secondary)
                        Button("Start workout") { player = NativeWorkout(store: store, plan: plan) }.buttonStyle(.borderedProminent).controlSize(.large)
                        if store.days[store.today] != nil { Text(store.status(store.today).capitalized).font(.headline).foregroundStyle(studioOrange) }
                        ForEach(plan["ids"] as? [String] ?? [], id: \.self) { id in
                            if let exercise = store.exercises.first(where: { $0.id == id }) {
                                Button { selected = exercise } label: {
                                    HStack {
                                        Image(systemName: "dumbbell.fill").font(.title2).foregroundStyle(studioOrange).frame(width: 44)
                                        VStack(alignment: .leading) { Text(exercise.name).font(.headline); Text(groupName(exercise.g)).font(.caption).foregroundStyle(.secondary) }
                                        Spacer(); Text("\(store.count(store.today, id))/\(plan["sets"] as? Int ?? 2)").monospacedDigit().foregroundStyle(.secondary)
                                        Image(systemName: "chevron.right").font(.caption)
                                    }.padding().background(.background, in: RoundedRectangle(cornerRadius: 18))
                                }.buttonStyle(.plain)
                            }
                        }
                    } else {
                        Text("Rest day").font(.largeTitle.bold())
                        Text("Let your muscles recover. Take a walk or browse the exercise library.").foregroundStyle(.secondary)
                        Button("Train anyway") { if let p = store.rule("train") as? [String: Any] { player = NativeWorkout(store: store, plan: p) } }.buttonStyle(.borderedProminent)
                    }
                    Text("Warm up for 3 minutes with marching, arm circles and slow squats.").font(.footnote).foregroundStyle(.secondary)
                }.padding()
            }.refreshable { await store.connect() }
        }
        .sheet(item: $selected) { NativeExerciseDetail(store: store, exercise: $0, date: store.today) }
        .fullScreenCover(item: $player) { NativePlayerView(store: store, workout: $0) }
    }
}
struct NativeLibrary: View {
    @ObservedObject var store: NativeStore
    @State private var search = ""
    @State private var group = "all"
    @State private var equipment = "all"
    @State private var selected: Exercise?
    var body: some View {
        NativeShell(store: store, title: "Library") {
            List {
                Picker("Equipment", selection: $equipment) { Text("All equipment").tag("all"); Text("Bodyweight").tag("bw"); Text("Dumbbells").tag("db") }.pickerStyle(.segmented)
                Picker("Muscle area", selection: $group) { Text("All areas").tag("all"); ForEach(studioGroups, id: \.self) { Text(groupName($0)).tag($0) } }
                ForEach(store.exercises.filter { (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search)) && (group == "all" || $0.g == group) && (equipment == "all" || $0.eq == equipment) }) { exercise in
                    Button { selected = exercise } label: {
                        HStack { Image(systemName: exercise.eq == "bw" ? "figure.strengthtraining.traditional" : "dumbbell.fill").foregroundStyle(studioOrange).frame(width: 40); VStack(alignment: .leading) { Text(exercise.name).foregroundStyle(.primary); Text(groupName(exercise.g) + " · " + (exercise.eq == "bw" ? "Bodyweight" : "Dumbbells")).font(.caption).foregroundStyle(.secondary) } }
                    }
                }
            }.scrollContentBackground(.hidden).searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search exercises")
        }.sheet(item: $selected) { NativeExerciseDetail(store: store, exercise: $0, date: store.today) }
    }
}
struct NativeExerciseDetail: View {
    @ObservedObject var store: NativeStore
    let exercise: Exercise; let date: String
    var onLog: (() -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var reps = 8
    @State private var seconds = 30
    @State private var kg = 0.0
    @State private var side = "left"
    @State private var editIndex: Int?
    @State private var undo: [String: Any]?
    @State private var runningHold: Date?
    var body: some View {
        NavigationStack {
            Form {
                if exercise.custom == nil { Section { NativeDemo(store: store, exercise: exercise).listRowInsets(EdgeInsets()).frame(height: 330) } }
                Section("Form") {
                    Text((exercise.muscles ?? [groupName(exercise.g)]).joined(separator: ", ")).font(.subheadline.bold())
                    ForEach(Array(exercise.steps.enumerated()), id: \.offset) { i, step in Text("\(i + 1). \(step)") }
                    if !exercise.tip.isEmpty { Text(exercise.tip).foregroundStyle(.secondary) }
                }
                Section(editIndex == nil ? "Log set" : "Edit set") {
                    if exercise.timed == 1 {
                        Stepper("Seconds: \(seconds)", value: $seconds, in: 1...86400, step: 5)
                        if let start = runningHold {
                            TimelineView(.periodic(from: .now, by: 1)) { context in Text("\(Int(context.date.timeIntervalSince(start))) seconds elapsed").monospacedDigit() }
                            Button("Stop timer") { seconds = max(1, Int(Date().timeIntervalSince(start))); runningHold = nil }
                        } else { Button("Start timer") { runningHold = Date() } }
                    } else { Stepper("Reps: \(reps)", value: $reps, in: 1...10000) }
                    if exercise.eq != "bw" { HStack { Text(exercise.singleBell == true ? "Dumbbell (kg)" : "Each dumbbell (kg)"); TextField("0", value: $kg, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing) } }
                    if exercise.unilateral == true { Picker("Side", selection: $side) { Text("Left").tag("left"); Text("Right").tag("right") }.pickerStyle(.segmented) }
                    Button(editIndex == nil ? "Log set" : "Save edit") {
                        guard kg.isFinite, kg >= 0, kg <= 1000 else { store.message = "Enter a weight between 0 and 1000 kg."; return }
                        var set: [String: Any] = exercise.timed == 1 ? ["s": seconds] : ["r": reps]
                        if kg > 0 { set["kg"] = kg }; if exercise.unilateral == true { set["side"] = side }
                        store.addSet(date, exercise, set, editIndex: editIndex); editIndex = nil; onLog?(); UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }.font(.headline).tint(studioOrange)
                    if editIndex != nil { Button("Cancel edit") { editIndex = nil } }
                }
                Section("Recorded sets · \(date)") {
                    let entries = store.day(date)["entries"] as? [[String: Any]] ?? []
                    let sets = entries.first { $0["ex"] as? String == exercise.id }?["sets"] as? [[String: Any]] ?? []
                    ForEach(Array(sets.enumerated()), id: \.offset) { i, set in
                        HStack { Text(setLabel(set)); Spacer(); Button("Edit") { editIndex = i; reps = set["r"] as? Int ?? 8; seconds = set["s"] as? Int ?? 30; kg = set["kg"] as? Double ?? 0; side = set["side"] as? String ?? "left" }; Button(role: .destructive) { undo = store.removeSet(date, exercise.id, i) } label: { Image(systemName: "trash") } }.buttonStyle(.borderless)
                    }
                    if let undo { Button("Undo removed set") { store.addSet(date, exercise, undo); self.undo = nil } }
                }
            }.navigationTitle(exercise.name).navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
struct NativeHistory: View {
    @ObservedObject var store: NativeStore
    @State private var selected: Exercise?
    @State private var selectedDate = ""
    var body: some View {
        NativeShell(store: store, title: "History") {
            List {
                if store.days.isEmpty { ContentUnavailableView("No workouts yet", systemImage: "calendar", description: Text("Log a set to start your history.")) }
                ForEach(store.days.keys.sorted().reversed(), id: \.self) { date in
                    Section {
                        ForEach(store.day(date)["entries"] as? [[String: Any]] ?? [], id: \.exerciseID) { entry in
                            let id = entry["ex"] as? String ?? "", sets = entry["sets"] as? [[String: Any]] ?? []
                            Button { selectedDate = date; selected = store.exercises.first { $0.id == id } } label: { VStack(alignment: .leading) { Text(store.exercises.first { $0.id == id }?.name ?? "Removed exercise").foregroundStyle(.primary); Text(sets.map(setLabel).joined(separator: " · ")).font(.caption).foregroundStyle(.secondary) } }
                        }
                        if store.day(date)["plan"] == nil {
                            Button(store.day(date)["completed"] as? Bool == true ? "Mark partial" : "Mark this custom workout complete") { var d = store.day(date); d["completed"] = !(d["completed"] as? Bool ?? false); store.saveDay(date, d) }
                        }
                    } header: { Text(date + " · " + store.status(date).capitalized) }
                }
            }.scrollContentBackground(.hidden).refreshable { await store.connect() }
        }.sheet(item: $selected) { NativeExerciseDetail(store: store, exercise: $0, date: selectedDate) }
    }
}
extension Dictionary where Key == String, Value == Any { var exerciseID: String { self["ex"] as? String ?? "" } }
