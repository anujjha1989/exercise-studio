import SwiftUI
import Network

@main
struct ExerciseStudioTVApp: App {
    var body: some Scene { WindowGroup { TVWorkoutView() } }
}
// Shared native renderer/store use UIKit on both Apple platforms.
func groupName(_ key:String) -> String { key.capitalized }
struct TVWorkoutView: View {
    @StateObject private var link = TVLink()
    @StateObject private var store = NativeStore(autoSync:false)
    @State private var code = ""
    @State private var endpoint: NWEndpoint?
    @State private var library = false
    @State private var selected = "curl"
    private var stale: Bool { Date().timeIntervalSince(link.lastReceived) > 8 }
    var body: some View {
        NavigationStack {
            VStack(spacing:24) {
                if let id = link.snapshot["exercise"] as? String, let ex = store.exercises.first(where: {$0.id == id}) {
                    TimelineView(.periodic(from:.now,by:1)) { _ in
                        HStack(spacing:48) {
                            NativeDemo(store:store,exercise:ex, externallyPaused: stale || link.snapshot["paused"] as? Bool == true, bodyweightOnly: link.snapshot["bodyweightOnly"] as? Bool == true).frame(width:850,height:650).clipShape(RoundedRectangle(cornerRadius:28))
                            VStack(alignment:.leading,spacing:24) {
                                Text(ex.name).font(.largeTitle.bold())
                                Text("Exercise \((link.snapshot["index"] as? Int ?? 0)+1) of \(link.snapshot["total"] as? Int ?? 1)").foregroundStyle(.secondary)
                                if link.snapshot["preview"] as? Bool == true { Text("Exercise preview").font(.title) } else { Text("\(link.snapshot["sets"] as? Int ?? 0) / \(link.snapshot["target"] as? Int ?? 2) sets").font(.title) }
                                if stale { Text("Connection paused · check your iPhone").foregroundStyle(.orange) }
                                else if link.snapshot["paused"] as? Bool == true { Text("Workout paused").foregroundStyle(.orange) }
                                else if let rest=link.snapshot["rest"] as? Int,rest>0 { Text("Rest · \(rest) sec").font(.title.monospacedDigit()) }
                                ScrollView { VStack(alignment:.leading,spacing:16) { ForEach(Array(ex.steps.enumerated()),id:\.offset) { i,step in Text("\(i+1). \(step)").font(.body) } } }.frame(maxHeight:350).focusable()
                                Text(link.snapshot["preview"] as? Bool == true ? "Control this preview on your iPhone." : "Log sets and control the session on your iPhone.").font(.caption).foregroundStyle(.secondary)
                            }.frame(maxWidth:600)
                        }
                    }
                    Button("Disconnect") { link.browse(); endpoint=nil; code="" }
                } else if library {
                    HStack(spacing:40) {
                        List(store.exercises) { ex in Button(ex.name) { selected=ex.id } }.frame(width:470)
                        if let ex=store.exercises.first(where: {$0.id == selected}) {
                            VStack { Text(ex.name).font(.title.bold()); NativeDemo(store:store,exercise:ex).frame(height:620); Text(ex.tip).font(.body) }.frame(maxWidth:1000)
                        }
                    }
                    Button("Back to connection") { library=false }
                } else {
                    Image(systemName:"appletv").font(.system(size:70)).foregroundStyle(.orange)
                    Text("Exercise Studio").font(.largeTitle.bold())
                    Text(link.status).foregroundStyle(.secondary)
                    Text("On your iPhone, open Setup → Connect Apple TV, or start a workout and choose Show workout on Apple TV. Enter its code here.").multilineTextAlignment(.center).frame(maxWidth:900)
                    ForEach(Array(link.devices.enumerated()),id:\.offset) { _,device in
                        Button("Connect to iPhone") { endpoint=device.endpoint }.buttonStyle(.borderedProminent)
                    }
                    if endpoint != nil {
                        TextField("12-character connection code",text:$code).textInputAutocapitalization(.characters).autocorrectionDisabled().frame(width:650)
                        Button("Pair") { if let endpoint { link.join(endpoint,code:code) } }.buttonStyle(.borderedProminent)
                    }
                    Button("Browse exercise library") { library=true }
                }
            }.padding(40).background(Color(red:0.04,green:0.07,blue:0.18))
        }.tint(.orange).task { link.browse() }
        .onDisappear { link.stop() }
    }
}
