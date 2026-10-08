import Foundation

enum ServerAddress {
    static let defaultURL = URL(string: "https://anujrpi.tail549492.ts.net/exercise/")!

    static func parse(_ value: String) -> URL? {
        guard var parts = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
              parts.scheme?.lowercased() == "https", let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil else { return nil }
        if parts.path.isEmpty { parts.path = "/" }
        if !parts.path.hasSuffix("/") { parts.path += "/" }
        return parts.url
    }

    static func sameOrigin(_ a: URL, _ b: URL) -> Bool {
        a.scheme?.lowercased() == b.scheme?.lowercased() && a.host?.lowercased() == b.host?.lowercased() && (a.port ?? 443) == (b.port ?? 443)
    }
}
