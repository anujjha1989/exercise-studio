import XCTest

final class CompanionUITests: XCTestCase {
    func testNativeLibraryDemoAndSingleTitle() {
        let app = XCUIApplication(); app.launchArguments = ["-nativeUITestOffline"]; app.launch()

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
