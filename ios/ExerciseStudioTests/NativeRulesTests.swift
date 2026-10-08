import XCTest
@testable import ExerciseStudio

@MainActor
final class NativeRulesTests: XCTestCase {
    private func store(_ directory: URL? = nil) -> NativeStore { NativeStore(cacheRoot: directory ?? FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString), autoSync: false) }
    func testAllBundledExercisesHaveNativeModelsAndFiniteSkeletons() {
        let s = store(); XCTAssertEqual(s.exercises.count, 54)
        for ex in s.exercises {
            for time in [0.0, 0.5, 1.0, 2.0] {
                let skeleton = s.rule("skeleton", ["id": ex.id, "time": time]) as? [String: Any]
                XCTAssertEqual((skeleton?["neck"] as? [Double])?.count, 3, ex.id)
                XCTAssertTrue((skeleton?["neck"] as? [Double] ?? []).allSatisfy(\.isFinite))
            }
        }
    }
    func testCompletionRequiresAllFrozenTargetsAndBothSides() {
        let s = store(); let day: [String: Any] = ["entries": [["ex":"onearmrow", "sets":[["r":8,"side":"left"],["r":8,"side":"left"]]]], "plan":["ids":["onearmrow"],"sets":2,"unilateral":["onearmrow"]]]
        XCTAssertEqual(s.rule("status", ["day":day]) as? String, "partial")
        var completed = day; completed["entries"] = [["ex":"onearmrow","sets":[["r":8,"side":"left"],["r":8,"side":"right"],["r":8,"side":"left"],["r":8,"side":"right"]]]]
        XCTAssertEqual(s.rule("status", ["day":completed]) as? String, "completed")
    }
    func testEquipmentFiltersAndNativeCachePreserveUnknownProfileFields() {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString), s = store(directory)
        s.profile["futureServerField"] = ["keep":true]; s.changeProfile("hasDumbbells", false); s.changeProfile("chair", false); s.changeProfile("dbs", [Double]())
        let plan = s.rule("train") as? [String: Any], ids = plan?["ids"] as? [String] ?? []
        XCTAssertFalse(ids.isEmpty)
        XCTAssertTrue(ids.allSatisfy { id in s.exercises.first { $0.id == id }?.eq != "db" })
        let restored = store(directory)
        XCTAssertEqual((restored.profile["futureServerField"] as? [String: Bool])?["keep"], true)
    }
    func testNativeLoggingDoesNotChangeFrozenPlan() {
        let s = store(); let ex = s.exercises.first { $0.id == "curl" }!
        let plan: [String: Any] = ["ids":["curl"], "name":"Arms", "sets":2, "scheme":["sets":2,"lo":8,"hi":12,"hold":30,"rest":75],"unilateral":[String]()]
        s.addSet(s.today,ex,["r":8,"kg":5],plan:plan)
        s.changeProfile("experience","experienced")
        s.addSet(s.today,ex,["r":9,"kg":5],plan:plan)
        XCTAssertEqual((s.day(s.today)["plan"] as? [String: Any])?["sets"] as? Int,2)
        XCTAssertEqual(s.status(s.today),"completed")
    }
}
