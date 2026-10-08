import SwiftUI
import Combine
import SceneKit
import simd

@MainActor
final class NativeFigure: ObservableObject {
    let scene = SCNScene(), camera = SCNNode()
    private var nodes: [String: SCNNode] = [:]
    init() {
        scene.background.contents = UIColor.white
        camera.camera = SCNCamera(); camera.camera?.usesOrthographicProjection = true; camera.camera?.orthographicScale = 48; camera.camera?.zNear = 0.1; camera.camera?.zFar = 600
        scene.rootNode.addChildNode(camera)
        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light?.type = .ambient; ambient.light?.intensity = 650; scene.rootNode.addChildNode(ambient)
        let light = SCNNode(); light.light = SCNLight(); light.light?.type = .omni; light.light?.intensity = 1300; light.position = SCNVector3(-70, 130, 90); scene.rootNode.addChildNode(light)
        let floor = SCNNode(geometry: SCNFloor()); floor.geometry?.firstMaterial?.diffuse.contents = UIColor(white: 0.97, alpha: 1); floor.geometry?.firstMaterial?.roughness.contents = 1; floor.position.y = -2; scene.rootNode.addChildNode(floor)
    }
    func update(store: NativeStore, exercise: Exercise, time: Double, highlights: Bool, view: Int) {
        guard let skeleton = store.rule("skeleton", ["id": exercise.id, "time": time]) as? [String: Any], let neck = skeleton["neck"] as? [Double], let hip = skeleton["hip"] as? [Double], let arms = skeleton["arms"] as? [[[Double]]], let legs = skeleton["legs"] as? [[[Double]]] else { return }
        for node in nodes.values { node.isHidden = true }
        let n = vector(neck), h = vector(hip), up = simd_normalize(n-h), front = simd_normalize(simd_cross(SIMD3<Float>(1,0,0), up)), orientation = simd_quatf(from: SIMD3<Float>(0,1,0), to: up)
        let gray = UIColor(white: 0.68, alpha: 1), red = UIColor(red: 0.88, green: 0.24, blue: 0.2, alpha: 1)
        func color(_ group: String) -> UIColor { highlights && exercise.g == group ? red : gray }
        ell("body", position: h + (n-h)*0.5, size: SIMD3(8.5, simd_length(n-h)*0.5, 4.3), color: gray, rotation: orientation)
        ell("head", position: n + up*7.4, size: SIMD3(4.4,5.4,4), color: gray, rotation: orientation)
        ell("hair", position: n + up*10.2 - front*0.4, size: SIMD3(4.4,2.8,4), color: .black, rotation: orientation)
        ell("nose", position: n + up*7 + front*4, size: SIMD3(0.8,1.2,1.2), color: gray, rotation: orientation)
        ell("shorts", position: h, size: SIMD3(7.7,4,4.9), color: UIColor(white:0.09, alpha:1), rotation: orientation)
        for side in [-1,1] {
            ell("pec\(side)", position: n - up*6 + front*4.2 + SIMD3(Float(side)*4.4,0,0), size: SIMD3(4.5,3.4,1.5), color: color("chest"), rotation: orientation)
            ell("lat\(side)", position: n - up*12 - front*3 + SIMD3(Float(side)*6,0,0), size: SIMD3(3,7,1.8), color: color("back"), rotation: orientation)
            for i in 0..<3 { ell("abs\(side)\(i)", position: h + up*(8+Float(i)*3.5) + front*4 + SIMD3(Float(side)*1.8,0,0), size: SIMD3(1.7,1.6,0.8), color: color("core"), rotation: orientation) }
        }
        for i in 0..<2 {
            let s = vector(arms[i][0]), e = vector(arms[i][1]), hand = vector(arms[i][2]), thigh = vector(legs[i][0]), knee = vector(legs[i][1]), foot = vector(legs[i][2])
            bone("arm\(i)", s, e, width:2.8, color:gray)
            ell("shoulder\(i)", position:s, size:SIMD3(4,4.2,3.6), color:color("shoulders"), rotation:orientation)
            bone("bicep\(i)", s + front*1.4, e + front*1.4, width:2.3, color:exercise.g == "arms" && (exercise.id == "curl" || exercise.id == "hammer") && highlights ? red : gray)
            bone("tricep\(i)", s - front*1.4, e - front*1.4, width:2.3, color:exercise.g == "arms" && exercise.id != "curl" && exercise.id != "hammer" && highlights ? red : gray)
            bone("forearm\(i)", e, hand, width:2.1, color:gray)
            ell("hand\(i)", position:hand, size:SIMD3(1.8,2.6,1.4), color:gray)
            bone("thigh\(i)", thigh, knee, width:4.2, color:color("legs")); bone("calf\(i)", knee, foot, width:2.6, color:gray)
            ell("foot\(i)", position:foot + SIMD3(0,0,2), size:SIMD3(2.3,1.8,4.4), color:gray)
            if exercise.db == 1 && (exercise.singleBell != true || i == 0) {
                let center = exercise.singleBell == true ? (vector(arms[0][2]) + vector(arms[1][2]))*0.5 : hand
                bone("handle\(i)", center-SIMD3(6,0,0), center+SIMD3(6,0,0), width:0.7, color:.darkGray)
                for side in [-1,1] { ell("weight\(i)\(side)", position:center+SIMD3(Float(side)*5.5,0,0), size:SIMD3(1.7,4,4), color: .black) }
            }
        }
        if let chair = exercise.prop?.chairX {
            let flip: Float = (skeleton["flip"] as? Double ?? 1) < 0 ? -1 : 1
            let z = Float(chair + 12 - 60)*flip
            cuboid("seat",position:SIMD3(0,18,z),size:SIMD3(28,2.5,26),color:.black)
            for x: Float in [-11,11] { for dz: Float in [-10,10] { cuboid("chairleg\(x)\(dz)",position:SIMD3(x,8,z+dz),size:SIMD3(1.8,18,1.8),color:.darkGray) } }
        }
        if let wall = exercise.prop?.wall { cuboid("wall",position:SIMD3(0,42,Float(wall-63)),size:SIMD3(40,88,1.5),color:UIColor(white:0.9,alpha:1)) }
        bone("neck", n, n+up*3, width:2.5, color:gray)
        let center = SIMD3<Float>(0, n.y < 35 ? 15 : 39, 0)
        camera.simdPosition = center + (view == 1 ? SIMD3(0,40,170) : view == 2 ? SIMD3(170,40,0) : SIMD3(130,100,150))
        camera.look(at: SCNVector3(center), up: SCNVector3(0,1,0), localFront: SCNVector3(0,0,-1))
    }
    private func cuboid(_ key: String, position: SIMD3<Float>, size: SIMD3<Float>, color: UIColor) {
        let node: SCNNode
        if let existing = nodes[key] { node = existing } else {
            node = SCNNode(geometry:SCNBox(width:1,height:1,length:1,chamferRadius:0)); nodes[key] = node; scene.rootNode.addChildNode(node)
        }
        node.isHidden = false; node.simdPosition = position; node.simdScale = size; node.geometry?.firstMaterial?.diffuse.contents = color
    }
    private func vector(_ p: [Double]) -> SIMD3<Float> { SIMD3(Float(p[0]),Float(p[1]),Float(p[2])) }
    private func ell(_ key: String, position: SIMD3<Float>, size: SIMD3<Float>, color: UIColor, rotation: simd_quatf = simd_quatf(angle: 0, axis: SIMD3(0,1,0))) {
        let node: SCNNode
        if let existing = nodes[key] { node = existing } else {
            let sphere = SCNSphere(radius: 1); sphere.segmentCount = 24; sphere.firstMaterial?.lightingModel = .blinn; sphere.firstMaterial?.specular.contents = UIColor(white:0.22,alpha:1); sphere.firstMaterial?.shininess = 0.25
            node = SCNNode(geometry:sphere); nodes[key] = node; scene.rootNode.addChildNode(node)
        }
        node.isHidden = false; node.simdPosition = position; node.simdScale = size; node.simdOrientation = rotation; node.geometry?.firstMaterial?.diffuse.contents = color
    }
    private func bone(_ key: String, _ a: SIMD3<Float>, _ b: SIMD3<Float>, width: Float, color: UIColor) {
        let delta = b-a; guard simd_length(delta)>0.01 else { return }
        ell(key, position:(a+b)*0.5, size:SIMD3(width,simd_length(delta)*0.5+0.5,width), color:color, rotation:simd_quatf(from:SIMD3(0,1,0),to:simd_normalize(delta)))
    }
}
struct NativeSceneView: UIViewRepresentable {
    let figure: NativeFigure
    func makeUIView(context: Context) -> SCNView { let view = SCNView(); view.scene = figure.scene; view.pointOfView = figure.camera; view.backgroundColor = .white; view.isPlaying = true; view.preferredFramesPerSecond = 30; view.antialiasingMode = .multisampling4X; return view }
    func updateUIView(_ view: SCNView, context: Context) {}
}
struct NativeDemo: View {
    @ObservedObject var store: NativeStore; let exercise: Exercise
    @StateObject private var figure = NativeFigure()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var playing = false
    @State private var highlights = true
    @State private var slow = false
    @State private var view = 0
    @State private var time = 0.0
    private let tick = Timer.publish(every: 1/30, on: .main, in: .common).autoconnect()
    var body: some View {
        VStack(spacing: 4) {
            NativeSceneView(figure: figure).accessibilityLabel("3D demonstration of " + exercise.name)
            HStack {
                Button { playing.toggle() } label: { Image(systemName: playing ? "pause.fill" : "play.fill") }.accessibilityLabel(playing ? "Pause demo" : "Play demo")
                Button { time = 0; draw() } label: { Image(systemName:"arrow.counterclockwise") }.accessibilityLabel("Replay")
                Button(["Isometric", "Front", "Side"][view]) { view = (view+1)%3; draw() }
                Button("Muscles") { highlights.toggle(); draw() }.opacity(highlights ? 1 : 0.6)
                Button("Slow") { slow.toggle() }.opacity(slow ? 1 : 0.6)
            }.font(.caption.bold()).buttonStyle(.bordered).padding(.horizontal,8).padding(.bottom,8)
        }.background(.white).foregroundStyle(Color(red:0.05,green:0.1,blue:0.24))
        .onAppear { draw(); playing = !reduceMotion }
        .onReceive(tick) { _ in if playing { time += slow ? 0.01 : 1/30; draw() } }
        .onDisappear { playing = false }
    }
    private func draw() { figure.update(store:store,exercise:exercise,time:time,highlights:highlights,view:view) }
}
