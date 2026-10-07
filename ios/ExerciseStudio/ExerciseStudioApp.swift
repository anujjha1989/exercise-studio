import SwiftUI

@main
struct ExerciseStudioApp: App {
    var body: some Scene { WindowGroup { StudioView() } }
}

struct StudioView: View {
    @StateObject private var session = StudioSession()
    @AppStorage("keepScreenAwake") private var keepAwake = false
    @Environment(\.scenePhase) private var scenePhase
    @State private var showSettings = false
    @State private var address = ""
    @State private var invalidAddress = false
    @State private var confirmReload = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let error = session.error {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Unable to connect").font(.headline)
                        Text(error).font(.subheadline)
                        Text("For your Pi address, turn on Tailscale and check the Pi is running. Your existing app data is retained.").font(.footnote)
                        Button("Try again") { session.load() }
                    }.padding().frame(maxWidth: .infinity, alignment: .leading)
                }
                StudioWebView(session: session)
            }
            .navigationTitle("Exercise Studio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if session.loading { ProgressView().accessibilityLabel("Loading Exercise Studio") }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { address = session.address.absoluteString; showSettings = true } label: { Image(systemName: "gearshape") }
                        .accessibilityLabel("App settings")
                }
            }
            .sheet(isPresented: $showSettings) {
                NavigationStack {
                    Form {
                        Section("Connection") {
                            TextField("HTTPS app address", text: $address).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                            if invalidAddress { Text("Enter an HTTPS address without a password, query or fragment.").foregroundStyle(.red) }
                            Button("Save address") {
                                guard let url = ServerAddress.parse(address) else { invalidAddress = true; return }
                                invalidAddress = false
                                if url != session.address { session.setAddress(url) }
                                showSettings = false
                            }
                            Text("Changing the server opens a different app. Pending edits remain with their original server. Sign in inside the app; passwords are never saved in these settings.").font(.footnote)
                        }
                        Section("During exercise") {
                            Toggle("Keep screen awake", isOn: $keepAwake)
                            Text("Applies while this app is open. Turn it off to use your normal screen lock.").font(.footnote)
                        }
                        Section {
                            Button("Reload app") { confirmReload = true }
                            ShareLink("Share app address", item: session.address)
                            Link("Open in Safari", destination: session.address)
                        } footer: {
                            Text("Your Pi stores the workout records. Safari and this app have separate sign-ins and local save queues. This companion needs a connection for first launch; offline behavior depends on WebKit and must be verified on your iPhone.")
                        }
                    }
                    .navigationTitle("App settings")
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showSettings = false } } }
                    .confirmationDialog("Reload Exercise Studio?", isPresented: $confirmReload, titleVisibility: .visible) {
                        Button("Reload") { showSettings = false; session.load() }
                    } message: { Text("Finish any set entry first. A running timer or unfinished form may be reset.") }
                }
            }
            .sheet(item: $session.sharedFile, onDismiss: session.cleanDownload) { file in
                FileShareView(url: file.url)
            }
            .alert("Download unavailable", isPresented: Binding(get: { session.downloadError != nil }, set: { if !$0 { session.downloadError = nil } })) {
                Button("OK", role: .cancel) { session.downloadError = nil }
            } message: { Text(session.downloadError ?? "") }
            .onChange(of: keepAwake) { _, _ in updateIdleTimer() }
            .onChange(of: scenePhase) { _, _ in updateIdleTimer() }
            .onAppear { updateIdleTimer() }
        }
    }

    private func updateIdleTimer() { UIApplication.shared.isIdleTimerDisabled = keepAwake && scenePhase == .active }
}

struct FileShareView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
