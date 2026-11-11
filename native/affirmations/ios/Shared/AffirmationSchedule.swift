import Foundation

/// Matches the web and Android contract: local civil day since 1970, then slot.
/// A Gregorian calendar avoids changes caused by the user's display calendar.
enum AffirmationSchedule {
    static func calendar(timeZone: TimeZone = .autoupdatingCurrent) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    static func ordinal(at date: Date, cadence: AffirmationCadence,
                        calendar: Calendar = AffirmationSchedule.calendar()) -> Int {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(secondsFromGMT: 0)!
        let civilMidnight = utc.date(from: parts)!
        let day = Int(floor(civilMidnight.timeIntervalSince1970 / 86_400))
        guard cadence == .moments else { return day }
        let hour = calendar.component(.hour, from: date)
        if hour < 7 { return (day - 1) * 3 + 2 }
        let slot = hour < 13 ? 0 : (hour < 20 ? 1 : 2)
        return day * 3 + slot
    }

    static func item(at date: Date, payload: AffirmationPayload,
                     calendar: Calendar = AffirmationSchedule.calendar()) -> AffirmationItem {
        let count = payload.items.count // The payload boundary rejects empty pools.
        let value = ordinal(at: date, cadence: payload.cadence, calendar: calendar)
        return payload.items[((value % count) + count) % count]
    }

    /// Calendar arithmetic, never +86,400 seconds, preserves local hours across DST.
    static func dates(after date: Date, cadence: AffirmationCadence,
                      calendar: Calendar = AffirmationSchedule.calendar()) -> [Date] {
        var dates = [date]
        let hours = cadence == .daily ? [0] : [7, 13, 20]
        let today = calendar.startOfDay(for: date)
        for offset in 0...3 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
            for hour in hours {
                guard let boundary = calendar.date(bySettingHour: hour, minute: 0, second: 0,
                                                   of: day, matchingPolicy: .nextTime,
                                                   repeatedTimePolicy: .first, direction: .forward),
                      boundary > date else { continue }
                dates.append(boundary)
            }
        }
        return Array(Set(dates)).sorted()
    }
}
