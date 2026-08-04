import Capacitor

final class TtcBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(TtcAdPurchasesPlugin())
    }
}
