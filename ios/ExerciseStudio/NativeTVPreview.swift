import SwiftUI
import Combine

/// Try the TV connection without creating a workout or changing any logs.
struct NativeTVPreview: View {
    @ObservedObject var store: NativeStore
    @StateObject private var link = TVLink()
    @Environment(\.dismiss) private var dismiss
    @State private var exerciseID = "curl"
    @State private var paused = false
    private let tick = Timer.publish(every:1,on:.main,in:.common).autoconnect()
    var body: some View {
        NavigationStack {
            Form {
                Section("Apple TV connection") {
                    Text(link.status)
                    if !link.code.isEmpty { Text(link.code).font(.title2.monospaced().bold()).textSelection(.enabled) }
                    Text("Open Exercise Studio on Apple TV and enter this code. Both devices need to be on the same local network. Keep this screen open while connected.").font(.caption).foregroundStyle(.secondary)
                    Button("New connection code") { link.host(); publish() }
                }
                Section("Preview exercise") {
                    Picker("Exercise",selection:$exerciseID) { ForEach(store.exercises.filter {$0.custom == nil}) { Text($0.name).tag($0.id) } }
                    if let exercise=store.exercises.first(where:{$0.id == exerciseID}) { NativeDemo(store:store,exercise:exercise,externallyPaused:paused).frame(height:330).listRowInsets(EdgeInsets()) }
                    Toggle("Pause TV demonstration",isOn:$paused)
                    Text("This preview does not log sets or change your workout plan. Start a workout from Today when you want to log your training.").font(.caption).foregroundStyle(.secondary)
                }
            }.navigationTitle("Apple TV preview").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement:.confirmationAction) { Button("Done") { dismiss() } } }
        }.onAppear { link.host();publish() }
        .onReceive(tick) { _ in publish() }
        .onDisappear { link.stop() }
    }
    private func publish() {
        link.publish(["exercise":exerciseID,"index":0,"total":1,"sets":0,"target":0,"paused":paused,"rest":0,"elapsed":0,"preview":true])
    }
}
