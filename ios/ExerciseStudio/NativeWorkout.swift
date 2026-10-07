import SwiftUI
import CryptoKit

@MainActor
final class NativeWorkout: ObservableObject, Identifiable {
    let id = UUID(); let date: String; let plan: [String: Any]
    @Published var index = 0 { didSet { persist() } }
    @Published var paused = false
    private(set) var newLogs = 0
    @Published var restEnd: Date? { didSet { persist() } }
    private var restRemaining = 0.0
    private var start = Date(), pauseStart: Date?, pausedSeconds = 0.0
    private let resumeFile: URL
    init(store: NativeStore, plan: [String: Any]) {
        let name = SHA256.hash(data: Data(store.address.absoluteString.utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        resumeFile = directory.appendingPathComponent("workout-" + name + ".json")
        let cached = (try? Data(contentsOf: resumeFile)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        date = cached?["date"] as? String ?? store.today
        self.plan = cached?["plan"] as? [String: Any] ?? plan
        if let cached {
            index = cached["index"] as? Int ?? 0
            newLogs = cached["newLogs"] as? Int ?? 0
            start = Date(timeIntervalSince1970: cached["start"] as? Double ?? Date().timeIntervalSince1970)
            pausedSeconds = cached["pausedSeconds"] as? Double ?? 0
            // A process restart resumes paused, rather than counting hours away.
            pauseStart = Date(timeIntervalSince1970: cached["savedAt"] as? Double ?? Date().timeIntervalSince1970)
            if let oldPause = cached["pauseStart"] as? Double { pauseStart = Date(timeIntervalSince1970: oldPause) }
            paused = true
        }
        var day = store.day(date); if day["plan"] == nil { day["plan"] = self.plan }; day["started"] = true; store.saveDay(date, day)
        persist()
    }
    func persist() {
        var payload: [String: Any] = ["date":date,"plan":plan,"index":index,"newLogs":newLogs,"start":start.timeIntervalSince1970,"pausedSeconds":pausedSeconds,"savedAt":Date().timeIntervalSince1970]
        if let pauseStart { payload["pauseStart"] = pauseStart.timeIntervalSince1970 }
        try? JSONSerialization.data(withJSONObject: payload).write(to:resumeFile,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
    }
    func finish() { try? FileManager.default.removeItem(at: resumeFile) }
    var ids: [String] { plan["ids"] as? [String] ?? [] }
    var elapsed: Int { max(0, Int((pauseStart ?? Date()).timeIntervalSince(start) - pausedSeconds)) }
    func togglePause() {
        if paused { pausedSeconds += Date().timeIntervalSince(pauseStart ?? Date()); pauseStart = nil; paused = false; if restRemaining > 0 { restEnd = Date().addingTimeInterval(restRemaining) } }
        else { pauseStart = Date(); restRemaining = max(0, restEnd?.timeIntervalSinceNow ?? 0); restEnd = nil; paused = true }
        persist()
    }
    func didLog() { newLogs += 1; persist(); rest() }
    func rest() { restEnd = Date().addingTimeInterval((plan["scheme"] as? [String: Any])?["rest"] as? Double ?? 75) }
}
struct NativePlayerView: View {
    @ObservedObject var store: NativeStore; @ObservedObject var workout: NativeWorkout
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var phase
    @State private var logging = false
    @State private var confirmEnd = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    TimelineView(.periodic(from: .now, by: 1)) { _ in Text("\(workout.elapsed / 60):\(String(format: "%02d", workout.elapsed % 60)) elapsed").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary) }
                    if workout.ids.indices.contains(workout.index), let exercise = store.exercises.first(where: { $0.id == workout.ids[workout.index] }) {
                        Text(exercise.name).font(.largeTitle.bold()).multilineTextAlignment(.center)
                        NativeDemo(store: store, exercise: exercise).frame(height: 320).clipShape(RoundedRectangle(cornerRadius: 20))
                        Text("\(store.count(workout.date, exercise.id)) / \(workout.plan["sets"] as? Int ?? 2) sets · \(groupName(exercise.g))").font(.headline)
                        if workout.paused { Text("Workout paused").font(.title3) }
                        else if let end = workout.restEnd {
                            TimelineView(.periodic(from: .now, by: 1)) { context in Text("Rest · \(max(0, Int(end.timeIntervalSince(context.date)))) sec").font(.title2.monospacedDigit()) }
                            Button("Skip rest") { workout.restEnd = nil }
                        }
                        Button("Log set") { logging = true }.buttonStyle(.borderedProminent).controlSize(.large).disabled(workout.paused)
                        HStack { Button("Previous") { workout.index = max(0, workout.index - 1); workout.restEnd = nil }.disabled(workout.index == 0); Spacer(); Button("Next") { workout.index = min(workout.ids.count - 1, workout.index + 1); workout.restEnd = nil }.disabled(workout.index >= workout.ids.count - 1) }
                        Button(workout.paused ? "Resume workout" : "Pause workout") { workout.togglePause() }.buttonStyle(.bordered)
                    }
                }.padding()
            }.background(studioPaper).navigationTitle(workout.plan["name"] as? String ?? "Workout").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("End") { confirmEnd = true } } }
            .confirmationDialog("End this workout?", isPresented: $confirmEnd, titleVisibility: .visible) {
                Button("Save \(store.status(workout.date).capitalized) workout") {
                    var day = store.day(workout.date); if workout.newLogs > 0 { day["min"] = (day["min"] as? Int ?? 0) + workout.elapsed / 60 }; day["started"] = false; store.saveDay(workout.date, day); workout.finish(); dismiss()
                }
            } message: { Text("Recorded sets are kept. Completion requires all planned sets, including both sides.") }
            .onChange(of: phase) { _, value in if value != .active && !workout.paused { workout.togglePause() } }
            .sheet(isPresented: $logging) {
                if workout.ids.indices.contains(workout.index), let exercise = store.exercises.first(where: { $0.id == workout.ids[workout.index] }) {
                    NativeExerciseDetail(store: store, exercise: exercise, date: workout.date, onLog: { logging = false; workout.didLog() })
                }
            }
        }
    }
}
