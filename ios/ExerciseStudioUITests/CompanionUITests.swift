import XCTest

final class CompanionUITests: XCTestCase {
    func testNativeSettings() throws {
        let app = XCUIApplication()
        app.launch()
        let settings = app.buttons["App settings"]
        XCTAssertTrue(settings.waitForExistence(timeout: 15))
        settings.tap()
        XCTAssertTrue(app.textFields["HTTPS app address"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.switches["Keep screen awake"].exists)
        app.buttons["Done"].tap()
    }

    func testActualHTTPSLibraryWhenCredentialsAreProvided() throws {
        guard let passphrase = ProcessInfo.processInfo.environment["STUDIO_TEST_PASSPHRASE"], !passphrase.isEmpty else {
            throw XCTSkip("Supply a local test-run passphrase to check the authenticated Pi app.")
        }
        let app = XCUIApplication()
        app.launch()
        if app.secureTextFields.firstMatch.waitForExistence(timeout: 8) {
            app.secureTextFields.firstMatch.tap()
            app.secureTextFields.firstMatch.typeText(passphrase)
            app.buttons["Open"].tap()
        }
        XCTAssertTrue(app.buttons["Library"].waitForExistence(timeout: 20))
        app.buttons["Library"].tap()
        XCTAssertTrue(app.staticTexts["Exercise library"].waitForExistence(timeout: 10))
    }
}
