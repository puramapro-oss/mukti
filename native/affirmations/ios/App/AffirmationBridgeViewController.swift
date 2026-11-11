import Capacitor
import Foundation
import UIKit
import WidgetKit

class AffirmationBridgeViewController: CAPBridgeViewController {
    private var clockObservers: [NSObjectProtocol] = []

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AffirmationWidgetPlugin())
        let changes: [Notification.Name] = [
            .NSSystemTimeZoneDidChange,
            UIApplication.significantTimeChangeNotification,
            UIApplication.willEnterForegroundNotification
        ]
        for name in changes {
            clockObservers.append(NotificationCenter.default.addObserver(
                forName: name, object: nil, queue: .main
            ) { _ in
                WidgetCenter.shared.reloadTimelines(ofKind: AffirmationStore.widgetKind)
            })
        }
    }

    deinit {
        clockObservers.forEach { NotificationCenter.default.removeObserver($0) }
    }
}
