import SwiftUI
import WebKit

struct NativeSignIn: View {
    @ObservedObject var store: NativeStore
    var body: some View {
        NavigationStack {
            SignInPage(store: store).navigationTitle("Sign in to your Pi").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Use offline") { store.needsSignIn = false } } }
        }
    }
}
struct SignInPage: UIViewRepresentable {
    @ObservedObject var store: NativeStore
    func makeCoordinator() -> Coordinator { Coordinator(store) }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration(); configuration.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: configuration); view.navigationDelegate = context.coordinator
        view.load(URLRequest(url: store.address)); return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    final class Coordinator: NSObject, WKNavigationDelegate {
        let store: NativeStore
        init(_ store: NativeStore) { self.store = store }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { Task { await store.connect() } }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(action.request.url.map { ServerAddress.sameOrigin($0, store.address) } == true ? .allow : .cancel)
        }
    }
}
