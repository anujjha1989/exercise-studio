import SwiftUI
import WebKit

struct SharedFile: Identifiable { let id = UUID(); let url: URL }

@MainActor
final class StudioSession: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    @Published var loading = false
    @Published var error: String?
    @Published var sharedFile: SharedFile?
    @Published var downloadError: String?
    private(set) var address: URL
    let webView: WKWebView
    private var destinations: [ObjectIdentifier: URL] = [:]
    private var shareDirectory: URL?

    override init() {
        address = ServerAddress.parse(UserDefaults.standard.string(forKey: "serverAddress") ?? "") ?? ServerAddress.defaultURL
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        #if DEBUG
        webView.isInspectable = true
        #endif
        load()
    }

    func setAddress(_ url: URL) {
        address = url
        UserDefaults.standard.set(url.absoluteString, forKey: "serverAddress")
        load()
    }
    func load() { error = nil; webView.load(URLRequest(url: address)) }
    func cleanDownload() {
        if let directory = shareDirectory { try? FileManager.default.removeItem(at: directory) }
        shareDirectory = nil; sharedFile = nil
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { loading = true; error = nil }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(error) }
    private func navigationFailed(_ failure: Error) {
        if (failure as NSError).code == NSURLErrorCancelled { return }
        loading = false; error = failure.localizedDescription
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loading = false; error = "The app view stopped. Try again to reopen it."
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if ServerAddress.sameOrigin(url, address) || url.scheme == "blob" {
            if action.shouldPerformDownload { decisionHandler(.download) }
            else { decisionHandler(.allow) }
        } else {
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated && ["https", "mailto", "tel"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let attachment = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().contains("attachment") == true
        decisionHandler(!response.canShowMIMEType || attachment ? .download : .allow)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self; loading = false }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self; loading = false }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let name = (suggestedFilename as NSString).lastPathComponent
            let url = directory.appendingPathComponent(name.isEmpty ? "exercise-studio-export" : name)
            destinations[ObjectIdentifier(download)] = url
            completionHandler(url)
        } catch { downloadError = error.localizedDescription; completionHandler(nil) }
    }
    func downloadDidFinish(_ download: WKDownload) {
        guard let url = destinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        if sharedFile != nil {
            try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
            downloadError = "Finish sharing the current file before exporting another."
            return
        }
        shareDirectory = url.deletingLastPathComponent(); sharedFile = SharedFile(url: url)
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let url = destinations.removeValue(forKey: ObjectIdentifier(download)) { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        downloadError = error.localizedDescription
    }
    // The web app uses confirmations for deletes, restore and conflict resolution.
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        presentDialog(message: message, confirm: completionHandler)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        presentDialog(message: message, confirm: nil, done: completionHandler)
    }
    private func presentDialog(message: String, confirm: ((Bool) -> Void)?, done: (() -> Void)? = nil) {
        guard var controller = webView.window?.rootViewController else { confirm?(false); done?(); return }
        while let presented = controller.presentedViewController { controller = presented }
        let alert = UIAlertController(title: "Exercise Studio", message: message, preferredStyle: .alert)
        if let confirm { alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in confirm(false) }) }
        alert.addAction(UIAlertAction(title: confirm == nil ? "OK" : "Continue", style: .default) { _ in confirm?(true); done?() })
        controller.present(alert, animated: true)
    }
}

struct StudioWebView: UIViewRepresentable {
    @ObservedObject var session: StudioSession
    func makeUIView(context: Context) -> WKWebView { session.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
