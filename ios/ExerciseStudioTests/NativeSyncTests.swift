import XCTest
@testable import ExerciseStudio

final class NativeMockProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (Int, [String: Any]))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let result = Self.handler?(request) ?? (503, [:])
        let response = HTTPURLResponse(url: request.url!, statusCode: result.0, httpVersion: nil, headerFields: ["Content-Type":"application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: (try? JSONSerialization.data(withJSONObject: result.1)) ?? Data())
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
@MainActor
final class NativeSyncTests: XCTestCase {
    private func store(_ dir: URL) -> NativeStore {
        let config = URLSessionConfiguration.ephemeral; config.protocolClasses = [NativeMockProtocol.self]
        return NativeStore(cacheRoot: dir, network: URLSession(configuration: config), autoSync: false)
    }
    func testStaleSavePreservesLocalEditAndRequiresResolution() async {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString), s = store(directory)
        var writes = 0
        NativeMockProtocol.handler = { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "If-Match"), "0"); writes += 1
            return (409, ["revision":7,"current":["goal":"trim", "future":"retained"]])
        }
        s.changeProfile("goal", "lose"); await s.flush(); await s.flush()
        XCTAssertEqual(writes, 1); XCTAssertEqual(s.profile["goal"] as? String, "lose"); XCTAssertNotNil(s.conflicts["profile"])
        let restored = store(directory); XCTAssertNotNil(restored.conflicts["profile"])
        restored.resolve("profile",keepLocal:false)
        XCTAssertEqual(restored.profile["goal"] as? String,"trim"); XCTAssertEqual(restored.profile["future"] as? String,"retained")
        NativeMockProtocol.handler = nil
    }
    func testQueuedDaySurvivesRestartAndSavesUsingServerRevision() async {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString), s = store(directory)
        s.addSet(s.today, s.exercises.first { $0.id == "curl" }!, ["r":8,"kg":5])
        let restored = store(directory)
        NativeMockProtocol.handler = { request in
            XCTAssertTrue(request.url!.path.contains("/api/days/")); XCTAssertEqual(request.value(forHTTPHeaderField:"If-Match"),"0")
            return (200,["ok":true,"revision":1])
        }
        await restored.flush()
        XCTAssertEqual(restored.count(restored.today,"curl"),1)
        var extraRequests = 0
        NativeMockProtocol.handler = { _ in extraRequests += 1; return (500,[:]) }
        let clean = store(directory); await clean.flush(); XCTAssertEqual(extraRequests,0)
        NativeMockProtocol.handler = nil
    }
}
