import Foundation
import Network

@main
struct TVLoopback {
    @MainActor static func main() async throws {
        let phone=TVLink(),tv=TVLink();defer {phone.stop();tv.stop()}
        phone.host(advertise:false,loopbackOnly:true)
        for _ in 0..<200 {if phone.port != nil {break};try await Task.sleep(for:.milliseconds(20))}
        guard let port=phone.port else {fatalError("Listener did not bind")}
        phone.publish(["exercise":"curl","sets":1,"target":2,"paused":false])
        tv.join(.hostPort(host:"127.0.0.1",port:port),code:phone.code)
        for _ in 0..<200 {if tv.snapshot["exercise"] != nil {break};try await Task.sleep(for:.milliseconds(20))}
        precondition(tv.snapshot["exercise"] as? String == "curl", "Initial encrypted frame")
        for index in 0..<40 {
            phone.publish(["exercise":"squat","sets":index,"paused":true])
            try await Task.sleep(for:.milliseconds(10))
        }
        for _ in 0..<200 {if tv.snapshot["sets"] as? Int == 39 {break};try await Task.sleep(for:.milliseconds(20))}
        precondition(tv.snapshot["sets"] as? Int == 39, "Successive encrypted frames")
        precondition(tv.snapshot["paused"] as? Bool == true)
        tv.stop()
        tv.join(.hostPort(host:"127.0.0.1",port:port),code:"AAAAAAAAAAAA")
        try await Task.sleep(for:.milliseconds(500))
        precondition(tv.snapshot.isEmpty,"Wrong pairing code")
        print("Encrypted loopback: initial update, 40 successive frames, pause and wrong-code rejection passed.")
    }
}
