import SwiftUI
import Combine
import SceneKit
import simd

@MainActor
final class NativeFigure: ObservableObject {
    let scene = SCNScene(), camera = SCNNode()
    private var pathExercise = ""
    private var pathPoints: [SIMD3<Float>] = []
    private var muscleTexture: UIImage? = {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 128, height: 8))
        return renderer.image { ctx in
            UIColor.white.setFill(); ctx.fill(CGRect(x:0,y:0,width:128,height:8))
            for x in stride(from:0,to:128,by:3) { UIColor(white:0.78,alpha:1).setFill(); ctx.fill(CGRect(x:x,y:0,width:1,height:8)) }
        }
    }()
    private var nodes: [String: SCNNode] = [:]
    init() {
        scene.background.contents = UIColor.white
        camera.camera = SCNCamera(); camera.camera?.usesOrthographicProjection = true; camera.camera?.orthographicScale = 48; camera.camera?.zNear = 0.1; camera.camera?.zFar = 600
        scene.rootNode.addChildNode(camera)
        let ambient = SCNNode(); ambient.light = SCNLight(); ambient.light?.type = .ambient; ambient.light?.intensity = 650; scene.rootNode.addChildNode(ambient)
        let light = SCNNode(); light.light = SCNLight(); light.light?.type = .omni; light.light?.intensity = 1300; light.position = SCNVector3(-70, 130, 90); scene.rootNode.addChildNode(light)
        let floor = SCNNode(geometry: SCNFloor()); floor.geometry?.firstMaterial?.diffuse.contents = UIColor(white: 0.97, alpha: 1); floor.geometry?.firstMaterial?.roughness.contents = 1; floor.position.y = -2; scene.rootNode.addChildNode(floor)
    }
    func update(store: NativeStore, exercise: Exercise, time: Double, highlights: Bool, view: Int, showPath: Bool = false) {
        guard let skeleton = store.skeleton(exercise.id,time:time), let neck = skeleton["neck"] as? [Double], let hip = skeleton["hip"] as? [Double], let arms = skeleton["arms"] as? [[[Double]]], let legs = skeleton["legs"] as? [[[Double]]] else { return }
        for node in nodes.values { node.isHidden = true }
        let n = vector(neck), h = vector(hip), up = simd_normalize(n-h), front = simd_normalize(simd_cross(SIMD3<Float>(1,0,0), up)), orientation = simd_quatf(from: SIMD3<Float>(0,1,0), to: up)
        let gray = UIColor(white: 0.78, alpha: 1), red = UIColor(red: 0.94, green: 0.29, blue: 0.2, alpha: 1), assisting = UIColor(red: 0.94,green:0.69,blue:0.63,alpha:1)
        let groups: [String:[String]] = ["chest":["chest"],"back":["back"],"shoulders":["shoulders"],"arms":[exercise.mv == "pull" ? "biceps":"triceps"],"core":["abs"],"legs":["quads","glutes"]]
        var primary = Set(groups[exercise.g] ?? [])
        if ["deadlift","singlerdl"].contains(exercise.id) { primary = ["hamstrings","glutes"] }
        if ["bridge","donkey"].contains(exercise.id) { primary = ["glutes"] }
        let secondary = Set((exercise.also ?? []).flatMap { groups[$0] ?? [] })
        func tone(_ part:String) -> UIColor { !highlights ? gray : primary.contains(part) ? red : secondary.contains(part) ? assisting : gray }
        let height = simd_length(n-h)/28
        func local(_ x:Float,_ y:Float,_ z:Float) -> SIMD3<Float> { h + SIMD3(x,0,0) + up*y*height + front*z }
        // Separate muscle surfaces retain the shared pose while exposing anatomical landmarks.
        ell("body", position:h, size:SIMD3(1,height,1),color:gray,rotation:orientation)
        for side:Float in [-1,1] {
            let key = String(side)
            ell("trap"+key,position:local(side*4.2,27,-1.6),size:SIMD3(5.2,2.3*height,2.9),color:tone("back"),rotation:orientation)
            ell("pecU"+key,position:local(side*4.9,22.6,4.2),size:SIMD3(4.7,2.5*height,1.75),color:tone("chest"),rotation:orientation)
            ell("pecL"+key,position:local(side*4.5,20.2,4.5),size:SIMD3(4.3,2.6*height,1.9),color:tone("chest"),rotation:orientation)
            ell("lat"+key,position:local(side*7.6,15.6,-2.6),size:SIMD3(2.9,7.6*height,2.5),color:tone("back"),rotation:orientation)
            ell("scapula"+key,position:local(side*4.9,22,-4.2),size:SIMD3(4.2,4.4*height,1.3),color:tone("back"),rotation:orientation)
            ell("erector"+key,position:local(side*1.9,8.5,-3.9),size:SIMD3(1.7,6.2*height,1.2),color:tone("back"),rotation:orientation)
            for i in 0..<4 { ell("abs\(key)\(i)",position:local(side*1.75,5.6+Float(i)*3.25,3.9),size:SIMD3(1.7,1.5*height,0.8),color:tone("abs"),rotation:orientation) }
            for i in 0..<3 { ell("serratus\(key)\(i)",position:local(side*(6.9-Float(i)*0.45),15.8+Float(i)*2,3.6),size:SIMD3(1.5,0.95*height,0.6),color:tone("abs"),rotation:orientation) }
            ell("oblique"+key,position:local(side*4.7,9.6,2.6),size:SIMD3(1.9,4.6*height,1.5),color:tone("abs"),rotation:orientation)
        }
        ell("head",position:local(0,35.1,0.1),size:SIMD3(4.3,5.3,4.1),color:gray,rotation:orientation)
        ell("hair",position:local(0,38,0),size:SIMD3(4.4,2.8,4.2),color:.black,rotation:orientation)
        ell("jaw",position:local(0,31.9,2.1),size:SIMD3(3.1,2,2.1),color:gray,rotation:orientation)
        ell("nose",position:local(0,34.6,4.3),size:SIMD3(0.7,1.3,1),color:gray,rotation:orientation)
        for side:Float in [-1,1] {
            ell("ear\(side)",position:local(side*4.3,34.4,0.1),size:SIMD3(0.6,1.25,0.8),color:gray,rotation:orientation)
            ell("eye\(side)",position:local(side*1.7,35.6,3.8),size:SIMD3(0.55,0.22,0.25),color:.darkGray,rotation:orientation)
        }
        ell("shorts",position:h,size:SIMD3(7.8,3.5,5.1),color:UIColor(white:0.09,alpha:1),rotation:orientation)
        for i in 0..<2 {
            let shoulder=vector(arms[i][0]), elbow=vector(arms[i][1]), hand=vector(arms[i][2]), thigh=vector(legs[i][0]), knee=vector(legs[i][1]), foot=vector(legs[i][2])
            func muscles(_ prefix:String,_ a:SIMD3<Float>,_ b:SIMD3<Float>,_ specs:[(Float,Float,Float,Float,Float,Float,String)]) {
                let direction=simd_normalize(b-a), length=simd_length(b-a), q=simd_quatf(from:SIMD3<Float>(0,1,0),to:direction)
                var face=front-direction*simd_dot(front,direction)
                if simd_length(face)<0.05 { face=up-direction*simd_dot(up,direction) }; face=simd_normalize(face)
                let lateral=simd_normalize(simd_cross(direction,face))
                for (j,v) in specs.enumerated() {
                    ell("\(prefix)\(i)\(j)",position:a+(b-a)*v.0+lateral*v.1+face*v.2,size:SIMD3(v.3,length*v.4,v.5),color:tone(v.6),rotation:q)
                }
            }
            bone("arm\(i)",shoulder,elbow,width:2.5,color:gray)
            for (j,offset) in [Float(-1.6),0,1.5].enumerated() { ell("delt\(i)\(j)",position:shoulder+front*offset,size:SIMD3(3.2,4.1,2.6),color:tone("shoulders"),rotation:orientation) }
            muscles("upper",shoulder,elbow,[(0.52,0,1.6,2.4,0.36,1.9,"biceps"),(0.72,1.5,0.6,1.3,0.2,1.3,"biceps"),(0.45,1.2,-1.4,1.9,0.38,1.8,"triceps"),(0.5,-0.9,-1.5,1.8,0.36,1.7,"triceps")])
            bone("forearm\(i)",elbow,hand,width:1.75,color:gray)
            muscles("fore",elbow,hand,[(0.3,1.1,0.5,1.5,0.3,1.5,"forearms"),(0.34,-0.9,0.3,1.6,0.32,1.6,"forearms"),(0.36,0.2,-1,1.3,0.3,1.2,"forearms")])
            ell("hand\(i)",position:hand,size:SIMD3(1.9,2.4,1.25),color:gray)
            bone("thigh\(i)",thigh,knee,width:3.9,color:gray)
            muscles("leg",thigh,knee,[(0.45,0,2.5,2.3,0.4,1.9,"quads"),(0.5,2.5,1.2,2.2,0.36,2.2,"quads"),(0.74,-1.9,1.7,1.9,0.2,1.7,"quads"),(0.5,1.5,-2.4,1.9,0.38,1.7,"hamstrings"),(0.5,-1.3,-2.5,1.8,0.37,1.6,"hamstrings")])
            ell("glute\(i)",position:thigh-front*3-up*1.6,size:SIMD3(4.1,4.2,2.9),color:tone("glutes"),rotation:orientation)
            bone("calf\(i)",knee,foot,width:2,color:gray)
            muscles("shin",knee,foot,[(0.3,1,-1.5,1.8,0.27,1.9,"calves"),(0.33,-1,-1.6,1.9,0.29,2,"calves")])
            ell("knee\(i)",position:knee,size:SIMD3(2.5,2.4,2.6),color:gray)
            ell("foot\(i)",position:foot+SIMD3(0,0,2.8),size:SIMD3(2.1,1.25,3.6),color:gray)
            if exercise.db == 1 && (exercise.singleBell != true || i == 0) {
                let center=exercise.singleBell == true ? (vector(arms[0][2])+vector(arms[1][2]))*0.5 : hand
                bone("handle\(i)",center-SIMD3(6,0,0),center+SIMD3(6,0,0),width:0.7,color:.darkGray)
                for side in [-1,1] { ell("weight\(i)\(side)",position:center+SIMD3(Float(side)*5.5,0,0),size:SIMD3(1.7,4,4),color:.black) }
            }
        }
        if let chair = exercise.prop?.chairX {
            let flip: Float = (skeleton["flip"] as? Double ?? 1) < 0 ? -1 : 1
            let z = Float(chair + 12 - 60)*flip
            cuboid("seat",position:SIMD3(0,18,z),size:SIMD3(28,2.5,26),color:.black)
            for x: Float in [-11,11] { for dz: Float in [-10,10] { cuboid("chairleg\(x)\(dz)",position:SIMD3(x,8,z+dz),size:SIMD3(1.8,18,1.8),color:.darkGray) } }
        }
        if let wall = exercise.prop?.wall { cuboid("wall",position:SIMD3(0,42,Float(wall-63)),size:SIMD3(40,88,1.5),color:UIColor(white:0.9,alpha:1)) }
        if showPath {
            if pathExercise != exercise.id {
                pathExercise = exercise.id; pathPoints = []
                let beat = store.timing(exercise.id)["beat"] as? Double ?? 0.95
                for step in 0..<16 {
                    if let pose = store.skeleton(exercise.id,time:Double(step)/15*beat),let sampleArms = pose["arms"] as? [[[Double]]] { pathPoints.append(vector(exercise.g == "legs" ? (pose["hip"] as? [Double] ?? sampleArms[0][2]) : sampleArms[0][2])) }
                }
            }
            for (index,point) in pathPoints.enumerated() { ell("path\(index)",position:point,size:SIMD3(0.5,0.5,0.5),color:UIColor(red:0.2,green:0.5,blue:0.9,alpha:0.6)) }
        }
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
            let sphere = SCNSphere(radius: 1); sphere.segmentCount = 24; sphere.firstMaterial?.lightingModel = .blinn; sphere.firstMaterial?.specular.contents = UIColor(white:0.22,alpha:1); sphere.firstMaterial?.shininess = 0.25; sphere.firstMaterial?.multiply.contents = muscleTexture
            node = SCNNode(geometry:key == "body" ? torsoGeometry() : sphere); nodes[key] = node; scene.rootNode.addChildNode(node)
        }
        node.isHidden = false; node.simdPosition = position; node.simdScale = size; node.simdOrientation = rotation; node.geometry?.firstMaterial?.diffuse.contents = color
    }
    private func torsoGeometry() -> SCNGeometry {
        let rings:[[Float]]=[[0,7.5,4.8],[0.12,7,4.6],[0.26,6.2,3.8],[0.4,6.7,4],[0.57,8.6,4.6],[0.72,10.4,5.2],[0.84,10.7,5],[0.94,9.6,4.1],[1,6,3.2],[1.05,3,2.7]]
        var vertices:[SCNVector3]=[], normals:[SCNVector3]=[], indices:[Int32]=[]
        for ring in rings {
            for i in 0..<48 {
                let angle=Float(i)/48*Float.pi*2
                vertices.append(SCNVector3(cos(angle)*ring[1],ring[0]*28,sin(angle)*ring[2]))
                normals.append(SCNVector3(simd_normalize(SIMD3(cos(angle)/ring[1],0,sin(angle)/ring[2]))))
            }
        }
        for r in 0..<(rings.count-1) { for i in 0..<48 {
            let a=Int32(r*48+i),b=Int32(r*48+(i+1)%48),c=a+48,d=b+48
            indices.append(contentsOf:[a,c,b,b,c,d])
        } }
        let geometry=SCNGeometry(sources:[SCNGeometrySource(vertices:vertices),SCNGeometrySource(normals:normals)],elements:[SCNGeometryElement(indices:indices,primitiveType:.triangles)])
        geometry.firstMaterial=SCNMaterial();geometry.firstMaterial?.lightingModel = .blinn;geometry.firstMaterial?.shininess=0.25; geometry.firstMaterial?.specular.contents=UIColor(white:0.22,alpha:1)
        return geometry
    }
    private func bone(_ key: String, _ a: SIMD3<Float>, _ b: SIMD3<Float>, width: Float, color: UIColor) {
        let delta = b-a; guard simd_length(delta)>0.01 else { return }
        ell(key, position:(a+b)*0.5, size:SIMD3(width,simd_length(delta)*0.5+0.5,width), color:color, rotation:simd_quatf(from:SIMD3(0,1,0),to:simd_normalize(delta)))
    }
}
struct NativeSceneView: UIViewRepresentable {
    let figure: NativeFigure
    var active: Bool = false
    func makeUIView(context: Context) -> SCNView { let view = SCNView(); view.scene = figure.scene; view.pointOfView = figure.camera; view.backgroundColor = .white; view.isPlaying = active; view.rendersContinuously = active; view.preferredFramesPerSecond = 30; view.antialiasingMode = .multisampling4X; return view }
    func updateUIView(_ view: SCNView, context: Context) { view.isPlaying = active; view.rendersContinuously = active }
}
struct NativeDemo: View {
    @ObservedObject var store: NativeStore; let exercise: Exercise
    var externallyPaused = false
    @StateObject private var figure = NativeFigure()
    @Environment(\.scenePhase) private var phase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var playing = false
    @State private var highlights = true
    @State private var slow = false
    @State private var showPath = false
    @State private var view = 0
    @State private var time = 0.0

    var body: some View {
        VStack(spacing: 4) {
            NativeSceneView(figure: figure, active: playing && phase == .active && !externallyPaused).accessibilityLabel("3D demonstration of " + exercise.name)
            Text("Red: primary muscles · Peach: assisting muscles").font(.caption).foregroundStyle(.secondary)
            HStack { Button("Starting position") { playing = false; time = 0; draw() }; Button("Movement path") { showPath.toggle(); draw() }.opacity(showPath ? 1 : 0.6) }.font(.caption).buttonStyle(.borderless)
            HStack {
                Button { playing.toggle() } label: { Image(systemName: playing ? "pause.fill" : "play.fill") }.accessibilityLabel(playing ? "Pause demo" : "Play demo")
                Button { time = 0; draw() } label: { Image(systemName:"arrow.counterclockwise") }.accessibilityLabel("Replay")
                Button(["Isometric", "Front", "Side"][view]) { view = (view+1)%3; draw() }
                Button("Muscles") { highlights.toggle(); draw() }.opacity(highlights ? 1 : 0.6)
                Button("Slow") { slow.toggle() }.opacity(slow ? 1 : 0.6)
            }.font(.caption.bold()).buttonStyle(.bordered).padding(.horizontal,8).padding(.bottom,8)
        }.background(.white).foregroundStyle(Color(red:0.05,green:0.1,blue:0.24))
        .onAppear { draw(); playing = !reduceMotion }
        .task(id: playing && phase == .active && !externallyPaused) {
            guard playing && phase == .active && !externallyPaused else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for:.milliseconds(33))
                guard !Task.isCancelled else { return }; time += slow ? 0.01 : 1/30; draw()
            }
        }
        .onChange(of: reduceMotion) { _, value in if value { playing = false } }
        .onChange(of: exercise.id) { _, _ in time = 0; draw() }
        .onDisappear { playing = false }
    }
    private func draw() { figure.update(store:store,exercise:exercise,time:time,highlights:highlights,view:view,showPath:showPath) }
}
