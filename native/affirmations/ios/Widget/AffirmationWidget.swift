import SwiftUI
import WidgetKit

private let unconfiguredMessage = "Choisis tes affirmations dans MUKTI."

struct AffirmationEntry: TimelineEntry {
    let date: Date
    let text: String
}

struct AffirmationProvider: TimelineProvider {
    func placeholder(in context: Context) -> AffirmationEntry {
        AffirmationEntry(date: Date(), text: unconfiguredMessage)
    }

    func getSnapshot(in context: Context, completion: @escaping (AffirmationEntry) -> Void) {
        completion(entry(at: Date(), payload: try? AffirmationStore().load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AffirmationEntry>) -> Void) {
        let now = Date()
        let payload = try? AffirmationStore().load()
        let dates = AffirmationSchedule.dates(after: now, cadence: payload?.cadence ?? .daily)
        let entries = dates.map { entry(at: $0, payload: payload) }
        // Reload at the next boundary so the provider sees the current time zone.
        // Future entries still provide offline fallback if iOS delays that reload.
        completion(Timeline(entries: entries, policy: .after(dates.dropFirst().first ?? now.addingTimeInterval(3600))))
    }

    private func entry(at date: Date, payload: AffirmationPayload?) -> AffirmationEntry {
        let text = payload.map { AffirmationSchedule.item(at: date, payload: $0).text }
        return AffirmationEntry(date: date, text: text ?? unconfiguredMessage)
    }
}

struct AffirmationWidgetView: View {
    let entry: AffirmationEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        surface
            .widgetURL(URL(string: "mukti://affirmations"))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("MUKTI. \(entry.text)")
            .accessibilityHint("Ouvre les affirmations de MUKTI.")
    }

    @ViewBuilder private var surface: some View {
        if family == .accessoryRectangular {
            if #available(iOS 17.0, *) {
                accessoryText.containerBackground(for: .widget) { Color.clear }
            } else {
                accessoryText
            }
        } else if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) { background }
        } else {
            content.padding(16).background(background)
        }
    }

    private var accessoryText: some View {
        Text(entry.text)
            .font(.system(.caption, design: .serif))
            .fontWeight(.medium)
            .lineLimit(3)
            .minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("MUKTI", systemImage: "sparkle")
                .font(.system(.caption2, design: .rounded).weight(.semibold))
                .foregroundStyle(.white.opacity(0.75))
            Spacer(minLength: 0)
            Text(entry.text)
                .font(.system(family == .systemSmall ? .callout : .title3, design: .serif))
                .fontWeight(.medium)
                .lineLimit(family == .systemSmall ? 6 : 4)
                .minimumScaleFactor(0.8)
                .foregroundStyle(.white)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var background: some View {
        LinearGradient(colors: [Color(red: 0.12, green: 0.10, blue: 0.21),
                                Color(red: 0.07, green: 0.20, blue: 0.22)],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

@main
struct MuktiAffirmationWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: AffirmationStore.widgetKind, provider: AffirmationProvider()) { entry in
            AffirmationWidgetView(entry: entry)
        }
        .configurationDisplayName("Affirmations MUKTI")
        .description("Tes affirmations choisies, chaque jour ou à trois moments de la journée.")
        .supportedFamilies([.accessoryRectangular, .systemSmall, .systemMedium])
    }
}
