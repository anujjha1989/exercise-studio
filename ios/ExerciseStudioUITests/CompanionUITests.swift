import XCTest

final class CompanionUITests: XCTestCase {
    func testNativeLibraryDemoAndSingleTitle() {
        let app = XCUIApplication(); app.launchArguments = ["-nativeUITestOffline", "-AppleInterfaceStyle", "Light"]; app.launch()

        XCTAssertTrue(app.tabBars.buttons["Library"].waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts["Saved on your Pi"].exists)
        app.tabBars.buttons["Library"].tap()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 5)); search.tap(); search.typeText("Biceps")
        let curl = app.buttons.containing(.staticText, identifier: "Biceps curl").firstMatch
        XCTAssertTrue(curl.waitForExistence(timeout: 5)); curl.tap()
        XCTAssertTrue(app.navigationBars["Biceps curl"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.webViews.count,0)
        let camera = app.buttons["Isometric"]
        XCTAssertTrue(camera.waitForExistence(timeout: 5)); camera.tap()
        XCTAssertTrue(app.buttons["Front"].exists)
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = "Native exercise demo"; attachment.lifetime = .keepAlways; add(attachment)
    }
}

extension CompanionUITests {
    func testSessionOptionsAndProgressAreNative() {
        let app=XCUIApplication();app.launchArguments=["-nativeUITestOffline"];app.launch()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout:15))
        let adjust=app.buttons["Adjust today's session"]
        if adjust.exists { adjust.tap() } else { app.buttons["Adjust a session"].tap() }
        XCTAssertTrue(app.navigationBars["Adjust session"].waitForExistence(timeout:5))
        XCTAssertTrue(app.switches["Bodyweight only"].exists)
        app.buttons["Cancel"].tap()
        app.tabBars.buttons["Progress"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS[c] %@","Your consistency")).firstMatch.waitForExistence(timeout:5))
        XCTAssertEqual(app.webViews.count,0)
    }
}

// Exercise the reorganized destinations without contacting the live service.
extension CompanionUITests {
    func testSettingsDestinationsAndDarkAppearance() {
        let app = XCUIApplication()
        app.launchArguments = ["-nativeUITestOffline", "-AppleInterfaceStyle", "Dark", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Settings"].waitForExistence(timeout:15))
        app.tabBars.buttons["Settings"].tap()
        app.buttons["Training Plan"].tap()
        XCTAssertTrue(app.navigationBars["Training Plan"].waitForExistence(timeout:5))
        XCTAssertTrue(app.staticTexts.matching(identifier:"Goal").firstMatch.exists)
        app.navigationBars.buttons.firstMatch.tap()
        app.buttons["Equipment"].tap()
        XCTAssertTrue(app.switches["I have dumbbells"].waitForExistence(timeout:5))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Dark settings at accessibility text size"; attachment.lifetime = .keepAlways; add(attachment)
    }
}

extension CompanionUITests {
    func testWorkoutControlsRemainAvailableAndLoggingIsCompact() {
        let app = XCUIApplication(); app.launchArguments = ["-nativeUITestOffline"]; app.launch()
        XCTAssertTrue(app.tabBars.buttons["Today"].waitForExistence(timeout:15))
        let start = ["Start workout", "Resume workout", "Train anyway"].map { app.buttons[$0] }.first { $0.exists }
        XCTAssertNotNil(start); start?.tap()
        let log = app.buttons["workoutLogSet"]
        XCTAssertTrue(log.waitForExistence(timeout:5)); XCTAssertTrue(log.isHittable)
        app.swipeUp(); XCTAssertTrue(log.isHittable)
        log.tap()
        XCTAssertTrue(app.buttons["Log set"].waitForExistence(timeout:5))
        XCTAssertFalse(app.buttons["Isometric"].exists)
        let attachment = XCTAttachment(screenshot:app.screenshot()); attachment.name = "Compact set entry"; attachment.lifetime = .keepAlways; add(attachment)
    }
}
