import XCTest
@testable import ExerciseStudio

final class ServerAddressTests: XCTestCase {
    func testServerAddressRequiresHTTPSWithoutEmbeddedCredentials() {
        for value in ["http://pi.local/exercise/", "https://user:secret@pi.test/", "https://pi.test/?token=secret", "https://pi.test/#fragment", "garbage"] {
            XCTAssertNil(ServerAddress.parse(value), value)
        }
        XCTAssertEqual(ServerAddress.parse("  https://pi.test/exercise  ")?.absoluteString, "https://pi.test/exercise/")
    }
    func testOriginPolicyDoesNotTrustLookalikeHostsOrDifferentPorts() {
        let base = URL(string: "https://pi.test/exercise/")!
        XCTAssertTrue(ServerAddress.sameOrigin(base, URL(string: "https://pi.test/login")!))
        XCTAssertFalse(ServerAddress.sameOrigin(base, URL(string: "https://pi.test.evil.test/")!))
        XCTAssertFalse(ServerAddress.sameOrigin(base, URL(string: "https://pi.test:444/")!))
        XCTAssertFalse(ServerAddress.sameOrigin(base, URL(string: "http://pi.test/")!))
    }
}
