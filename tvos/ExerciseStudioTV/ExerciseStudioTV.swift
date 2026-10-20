import Network
import SwiftUI

@main
struct ExerciseStudioTVApp: App {
  var body: some Scene { WindowGroup { TVWorkoutView() } }
}
// Shared native renderer/store use UIKit on both Apple platforms.
func groupName(_ key: String) -> String { key.capitalized }
struct TVWorkoutView: View {
  @StateObject private var link = TVLink()
  @StateObject private var store = NativeStore(autoSync: false)
  @State private var code = ""
  @State private var endpoint: NWEndpoint?
  @State private var library = false
  @State private var showForm = false
  @State private var selected = "curl"
  private var stale: Bool { Date().timeIntervalSince(link.lastReceived) > 8 }
  var body: some View {
    NavigationStack {
      VStack(spacing: 24) {
        if let id = link.snapshot["exercise"] as? String,
          let ex = store.exercises.first(where: { $0.id == id })
        {
          TimelineView(.periodic(from: .now, by: 1)) { context in
            HStack(spacing: 48) {
              NativeDemo(
                store: store, exercise: ex,
                externallyPaused: stale || link.snapshot["paused"] as? Bool == true,
                bodyweightOnly: link.snapshot["bodyweightOnly"] as? Bool == true,
                showsControls: false
              ).frame(maxWidth: 1000, minHeight: 650).clipShape(RoundedRectangle(cornerRadius: 28))
              VStack(alignment: .leading, spacing: 24) {
                Text(ex.name).font(.largeTitle.bold())
                Text(
                  "Exercise \((link.snapshot["index"] as? Int ?? 0)+1) of \(link.snapshot["total"] as? Int ?? 1)"
                ).foregroundStyle(.secondary)
                if link.snapshot["preview"] as? Bool == true {
                  Text("Exercise preview").font(.title)
                } else {
                  Text(
                    "\(link.snapshot["sets"] as? Int ?? 0) / \(link.snapshot["target"] as? Int ?? 2) sets"
                  ).font(.system(size: 52, weight: .semibold, design: .rounded))
                }
                if stale {
                  Text("Connection paused · check your iPhone").foregroundStyle(.orange)
                } else if link.snapshot["paused"] as? Bool == true {
                  Text("Workout paused").foregroundStyle(.orange)
                } else if let rest = link.snapshot["rest"] as? Int, rest > 0 {
                  Text("Rest · \(rest) sec").font(
                    .system(size: 64, weight: .semibold, design: .rounded).monospacedDigit())
                }
                Text(ex.tip.isEmpty ? (ex.steps.first ?? "") : ex.tip).font(.title3).fixedSize(
                  horizontal: false, vertical: true)
                Button("Form Guidance") { showForm = true }
                  .sheet(isPresented: $showForm) {
                    VStack(alignment: .leading, spacing: 24) {
                      Text(ex.name).font(.title)
                      ForEach(Array(ex.steps.enumerated()), id: \.offset) { i, step in
                        Text("\(i+1). \(step)").font(.body)
                      }
                      Button("Done") { showForm = false }
                    }.padding(80)
                  }

                Text(
                  link.snapshot["preview"] as? Bool == true
                    ? "Control this preview on your iPhone."
                    : "Log sets and control the session on your iPhone."
                ).font(.caption).foregroundStyle(.secondary)
              }.frame(maxWidth: 600)
            }.onChange(of: context.date) { _, _ in updateIdleTimer() }
          }
          Button("Disconnect") {
            link.browse()
            endpoint = nil
            code = ""
          }
        } else if library {
          HStack(spacing: 40) {
            List(store.exercises) { ex in Button(ex.name) { selected = ex.id } }.frame(width: 470)
            if let ex = store.exercises.first(where: { $0.id == selected }) {
              VStack {
                Text(ex.name).font(.title.bold())
                NativeDemo(store: store, exercise: ex).frame(height: 620)
                Text(ex.tip).font(.body)
              }.frame(maxWidth: 1000)
            }
          }
          Button("Back to connection") { library = false }
        } else {
          Image(systemName: "appletv").font(.system(size: 70)).foregroundStyle(.orange)
          Text("Exercise Studio").font(.largeTitle.bold())
          Text(link.status).foregroundStyle(.secondary)
          Text(
            endpoint == nil
              ? "1. On iPhone, open Settings → Connect Apple TV.\n2. Select your iPhone below."
              : "3. Enter the connection code shown on your iPhone."
          ).multilineTextAlignment(.center).frame(maxWidth: 900)
          ForEach(Array(link.devices.enumerated()), id: \.offset) { _, device in
            Button(deviceName(device.endpoint)) { endpoint = device.endpoint }.buttonStyle(
              .borderedProminent)
          }
          if endpoint != nil {
            TextField("12-character connection code", text: $code).textInputAutocapitalization(
              .characters
            ).autocorrectionDisabled().frame(width: 650)
            Button("Pair") { if let endpoint { link.join(endpoint, code: code) } }.buttonStyle(
              .borderedProminent)
          }
          Button("Browse exercise library") { library = true }
        }
      }.padding(.horizontal, 80).padding(.vertical, 60).frame(
        maxWidth: .infinity, maxHeight: .infinity
      ).background(Color(uiColor: demoSurface))
    }.tint(.orange).task { link.browse() }
      .onChange(of: link.status) { _, _ in updateIdleTimer() }
      .onChange(of: link.snapshot["paused"] as? Bool) { _, _ in updateIdleTimer() }
      .onDisappear {
        link.stop()
        UIApplication.shared.isIdleTimerDisabled = false
      }

  }
  private func deviceName(_ endpoint: NWEndpoint) -> String {
    if case .service(let name, _, _, _) = endpoint {
      return "Connect to " + name.replacingOccurrences(of: " · Exercise Studio", with: "")
    }
    return "Connect to iPhone"
  }
  private func updateIdleTimer() {
    let active =
      link.status == "Connected to iPhone" && link.snapshot["paused"] as? Bool != true && !stale
    if UIApplication.shared.isIdleTimerDisabled != active {
      UIApplication.shared.isIdleTimerDisabled = active
    }
  }

}
