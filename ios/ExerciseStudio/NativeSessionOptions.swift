import SwiftUI

struct NativeSessionOptions: View {
    @ObservedObject var store: NativeStore
    @Environment(\.dismiss) private var dismiss
    @State private var minutes = 30
    @State private var bodyweight = false
    @State private var noChair = false
    @State private var substitutions: [String: String] = [:]
    private var proposed: [String: Any] {
        var plan = store.rule("flex", ["minutes": minutes, "bodyweight": bodyweight, "noChair": noChair]) as? [String: Any] ?? [:]
        let ids = (plan["ids"] as? [String] ?? []).map { substitutions[$0] ?? $0 }
        plan["ids"] = ids; plan["unilateral"] = ids.filter { id in store.exercises.first { $0.id == id }?.unilateral == true }
        return plan
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Today only") {
                    Picker("Available time", selection: $minutes) { ForEach([15,20,30,45,60], id: \.self) { Text("\($0) minutes").tag($0) } }
                    Toggle("Bodyweight only", isOn: $bodyweight)
                    Toggle("No chair or bench", isOn: $noChair)
                    Text("Your weekly setup stays the same. Already logged sessions keep their original targets.").font(.caption).foregroundStyle(.secondary)
                }
                Section("Exercise alternatives") {
                    let base = store.rule("flex", ["minutes":minutes,"bodyweight":bodyweight,"noChair":noChair]) as? [String:Any] ?? [:]
                    ForEach(base["ids"] as? [String] ?? [], id: \.self) { id in
                        if let ex = store.exercises.first(where: {$0.id == id}) {
                            let alternatives = (store.rule("substitutes", ["id":id,"used":(proposed["ids"] as? [String] ?? []).filter {$0 != (substitutions[id] ?? id)}]) as? [String] ?? []).filter { candidate in
                                guard let e = store.exercises.first(where: {$0.id == candidate}) else { return false }
                                return (!bodyweight || e.eq != "db") && (!noChair || e.prop?.chairX == nil)
                            }
                            Picker(ex.name, selection: Binding(get: {substitutions[id] ?? id}, set: {substitutions[id] = $0})) {
                                Text(ex.name).tag(id)
                                ForEach(alternatives, id:\.self) { candidate in Text(store.exercises.first {$0.id == candidate}?.name ?? candidate).tag(candidate) }
                            }
                        }
                    }
                    if (proposed["ids"] as? [String] ?? []).isEmpty { Text("No exercises fit these settings. Add equipment or allow more time.") }
                }
                Button("Use this session") {
                    var day = store.day(store.today)
                    guard !(day["entries"] as? [[String:Any]] ?? []).contains(where: { !($0["sets"] as? [[String:Any]] ?? []).isEmpty }) else { store.message = "This workout has logged sets. Its targets are kept."; return }
                    day["plan"] = proposed; store.saveDay(store.today, day); dismiss()
                }.disabled((proposed["ids"] as? [String] ?? []).isEmpty)
            }.navigationTitle("Adjust session").toolbar { ToolbarItem(placement:.cancellationAction) { Button("Cancel") { dismiss() } } }
            .onChange(of: bodyweight) { _,_ in substitutions = [:] }.onChange(of: noChair) { _,_ in substitutions = [:] }.onChange(of: minutes) { _,_ in substitutions = [:] }
        }.onAppear { minutes = store.profile["minutes"] as? Int ?? 30 }
    }
}
