import XCTest
@testable import ExerciseStudio

@MainActor
final class EnhancementTests: XCTestCase {
    func testFlexiblePlanKeepsProfileAndLoggedPlan() {
        let store=NativeStore(cacheRoot:FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString),autoSync:false)
        store.changeProfile("minutes",45)
        let plan=store.rule("flex",["minutes":15,"bodyweight":true,"noChair":true]) as! [String:Any]
        XCTAssertEqual(store.profile["minutes"] as? Int,45)
        for id in plan["ids"] as? [String] ?? [] {
            let ex=store.exercises.first {$0.id == id}!
            XCTAssertEqual(ex.eq,"bw"); XCTAssertNil(ex.prop?.chairX)
        }
        let frozen:[String:Any]=["name":"Frozen","ids":["curl"],"sets":2,"scheme":["lo":8,"hi":12,"rest":75],"unilateral":[]]
        store.saveDay(store.today,["plan":frozen,"entries":[["ex":"curl","sets":[["r":8,"kg":5]]]]])
        store.changeProfile("goal","lose")
        XCTAssertEqual(store.plan()?["name"] as? String,"Frozen")
    }
    func testDetailedFigureUsesFiniteTransformsAndStopsGrowingNodes() {
        let store=NativeStore(cacheRoot:FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString),autoSync:false), figure=NativeFigure()
        for ex in store.exercises where ex.custom == nil {
            figure.update(store:store,exercise:ex,time:0,highlights:true,view:0,showPath:true)
            figure.update(store:store,exercise:ex,time:0.7,highlights:true,view:2)
            for node in figure.scene.rootNode.childNodes {
                XCTAssertTrue(node.position.x.isFinite && node.position.y.isFinite && node.position.z.isFinite,ex.id)
            }
        }
        let count=figure.scene.rootNode.childNodes.count
        for _ in 0..<30 { figure.update(store:store,exercise:store.exercises.first!,time:0.5,highlights:true,view:0) }
        XCTAssertEqual(figure.scene.rootNode.childNodes.count,count)
    }
    func testPendingIndicatorSurvivesRestart() {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store=NativeStore(cacheRoot:directory,autoSync:false)
        store.addSet(store.today,store.exercises.first!,["r":8]); XCTAssertEqual(store.pendingCount,1)
        XCTAssertEqual(NativeStore(cacheRoot:directory,autoSync:false).pendingCount,1)
    }
    func testRestPauseAndResumePreservesRemainingTime() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store=NativeStore(cacheRoot:directory,autoSync:false)
        let plan:[String:Any]=["ids":["curl"],"sets":2,"scheme":["rest":75]]
        let workout=NativeWorkout(store:store,plan:plan,resumeDirectory:directory)
        workout.rest(); workout.togglePause()
        XCTAssertNil(workout.restEnd)
        let restored=NativeWorkout(store:store,plan:plan,resumeDirectory:directory)
        XCTAssertTrue(restored.paused);restored.togglePause()
        XCTAssertGreaterThan(restored.restEnd!.timeIntervalSinceNow,70)
        restored.restEnd=Date().addingTimeInterval(-1);restored.checkRest()
        XCTAssertNil(restored.restEnd);XCTAssertTrue(restored.restFinished);restored.finish()
    }

}
