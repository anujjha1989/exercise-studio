import XCTest
import Network
@testable import ExerciseStudio

@MainActor
final class TVLinkTests: XCTestCase {
    func testEncryptedLocalSessionAndDisconnect() async throws {
        let phone=TVLink(),tv=TVLink(); defer { phone.stop(); tv.stop() }
        phone.host(advertise:false,loopbackOnly:true)
        for _ in 0..<100 { if phone.port != nil { break }; try await Task.sleep(for:.milliseconds(20)) }
        let port=try XCTUnwrap(phone.port)
        XCTAssertEqual(phone.code.count,12)
        phone.publish(["exercise":"curl","sets":1,"target":2,"paused":false,"elapsed":5])
        tv.join(.hostPort(host:"127.0.0.1",port:port),code:phone.code)
        for _ in 0..<100 { if tv.snapshot["exercise"] != nil { break }; try await Task.sleep(for:.milliseconds(20)) }
        XCTAssertEqual(tv.snapshot["exercise"] as? String,"curl")
        XCTAssertEqual(tv.snapshot["sets"] as? Int,1)
        XCTAssertNil(tv.snapshot["profile"]); XCTAssertNil(tv.snapshot["photos"])
        phone.publish(["exercise":"squat","paused":true,"elapsed":6])
        for _ in 0..<100 { if tv.snapshot["exercise"] as? String == "squat" { break }; try await Task.sleep(for:.milliseconds(20)) }
        XCTAssertEqual(tv.snapshot["paused"] as? Bool,true)
        tv.stop(); XCTAssertTrue(tv.snapshot.isEmpty)
    }
    func testWrongPairingCodeCannotReadWorkout() async throws {
        let phone=TVLink(),tv=TVLink(); defer {phone.stop();tv.stop()}
        phone.host(advertise:false,loopbackOnly:true)
        for _ in 0..<100 { if phone.port != nil { break }; try await Task.sleep(for:.milliseconds(20)) }
        let port=try XCTUnwrap(phone.port); phone.publish(["exercise":"curl"])
        tv.join(.hostPort(host:"127.0.0.1",port:port),code:"AAAAAAAAAAAA")
        try await Task.sleep(for:.milliseconds(350))
        XCTAssertTrue(tv.snapshot.isEmpty)
    }
}
