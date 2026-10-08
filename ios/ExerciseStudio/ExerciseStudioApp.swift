import SwiftUI

@main
struct ExerciseStudioApp: App {
    var body: some Scene { WindowGroup { NativeRootView() } }
}
struct FileShareView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
