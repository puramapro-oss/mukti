import Capacitor
import Foundation
import WidgetKit

@objc(AffirmationWidgetPlugin)
public class AffirmationWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AffirmationWidgetPlugin"
    public let jsName = "AffirmationWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]
    private let store = AffirmationStore()

    @objc func getState(_ call: CAPPluginCall) {
        withTrustedOrigin(call) {
            guard #available(iOS 16.0, *) else {
                call.resolve(["supported": false, "configured": false])
                return
            }
            do {
                let payload = try self.store.load()
                var response: [String: Any] = ["supported": true, "configured": payload != nil]
                if let payload = payload {
                    response["payload"] = String(data: try payload.encoded(), encoding: .utf8)
                }
                WidgetCenter.shared.getCurrentConfigurations { result in
                    if case .success(let widgets) = result {
                        response["installed"] = widgets.contains { $0.kind == AffirmationStore.widgetKind }
                    }
                    call.resolve(response)
                }
            } catch { self.reject(call, error) }
        }
    }

    @objc func configure(_ call: CAPPluginCall) {
        withTrustedOrigin(call) {
            guard #available(iOS 16.0, *) else {
                call.reject("Ce widget nécessite iOS 16 ou une version ultérieure.", "UNSUPPORTED_OS")
                return
            }
            guard let input = call.getString("payload") else {
                call.reject("La configuration du widget est manquante.", "INVALID_PAYLOAD")
                return
            }
            do {
                try self.store.save(input)
                WidgetCenter.shared.reloadTimelines(ofKind: AffirmationStore.widgetKind)
                call.resolve(["saved": true])
            } catch { self.reject(call, error) }
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        withTrustedOrigin(call) {
            do {
                try self.store.clear()
                WidgetCenter.shared.reloadTimelines(ofKind: AffirmationStore.widgetKind)
                call.resolve(["cleared": true])
            } catch { self.reject(call, error) }
        }
    }

    private func withTrustedOrigin(_ call: CAPPluginCall, action: @escaping () -> Void) {
        DispatchQueue.main.async {
            guard let url = self.bridge?.webView?.url,
                  url.scheme == "https", url.host == "mukti.purama.dev",
                  url.port == nil || url.port == 443,
                  url.user == nil, url.password == nil else {
                call.reject("Le widget peut être configuré uniquement depuis MUKTI.", "UNTRUSTED_ORIGIN")
                return
            }
            action()
        }
    }

    private func reject(_ call: CAPPluginCall, _ error: Error) {
        let code = error is AffirmationStoreError ? "APP_GROUP_UNAVAILABLE" : "WIDGET_STORAGE_ERROR"
        call.reject(error.localizedDescription, code)
    }
}
