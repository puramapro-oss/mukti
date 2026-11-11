import Foundation

enum AffirmationValidationError: LocalizedError {
    case invalid(String)

    var errorDescription: String? {
        switch self {
        case .invalid(let reason): return "Configuration du widget invalide : \(reason)."
        }
    }
}

enum AffirmationCadence: String, Encodable {
    case daily
    case moments
}

struct AffirmationItem: Encodable, Equatable {
    let id: String
    let text: String
}

/// Only the public-catalogue projection may reach this boundary. The server owns
/// catalogue provenance; the bridge independently validates every field and size.
struct AffirmationPayload: Encodable, Equatable {
    static let maximumBytes = 20 * 1024
    let schemaVersion: Int
    let cadence: AffirmationCadence
    let items: [AffirmationItem]
    let configuredAt: String

    static func parse(_ data: Data) throws -> AffirmationPayload {
        guard !data.isEmpty, data.count <= maximumBytes else {
            throw AffirmationValidationError.invalid("taille maximale de 20 Kio")
        }
        // JSONSerialization on Darwin strips a leading U+FEFF from JSON strings.
        // Decode directly to Swift strings so validation sees every original scalar.
        let object = try JSONDecoder().decode(AffirmationDocument.self, from: data)
        guard object.schemaVersion == 1,
              let cadence = AffirmationCadence(rawValue: object.cadence),
              (1...30).contains(object.items.count),
              validTimestamp(object.configuredAt) else {
            throw AffirmationValidationError.invalid("format ou version non pris en charge")
        }

        var ids = Set<String>()
        var texts = Set<String>()
        let items = try object.items.map { raw -> AffirmationItem in
            let id = raw.id
            let text = raw.text
            let scalars = text.unicodeScalars
            guard UUID(uuidString: id) != nil, id.count == 36,
                  (1...100).contains(scalars.count),
                  let first = scalars.first, let last = scalars.last,
                  !ecmaWhitespace(first), !ecmaWhitespace(last),
                  scalars.contains(where: visibleScalar),
                  !scalars.contains(where: disallowedScalar) else {
                throw AffirmationValidationError.invalid("affirmation publique courte requise")
            }
            let normalizedID = id.lowercased()
            let normalizedText = text.precomposedStringWithCompatibilityMapping
            guard ids.insert(normalizedID).inserted,
                  texts.insert(normalizedText.lowercased()).inserted else {
                throw AffirmationValidationError.invalid("affirmations en double")
            }
            return AffirmationItem(id: normalizedID, text: text)
        }
        return AffirmationPayload(schemaVersion: 1, cadence: cadence,
                                  items: items, configuredAt: object.configuredAt)
    }

    func encoded() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(self)
    }

    private static func validTimestamp(_ value: String) -> Bool {
        let pattern = #"^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,9})?Z$"#
        guard value.count <= 30,
              let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)),
              match.range.length == value.utf16.count else { return false }
        let fields = (1...6).compactMap { index -> Int? in
            guard let range = Range(match.range(at: index), in: value) else { return nil }
            return Int(value[range])
        }
        guard fields.count == 6, fields[0] >= 1 else { return false }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let requested = DateComponents(year: fields[0], month: fields[1], day: fields[2],
                                       hour: fields[3], minute: fields[4], second: fields[5])
        guard let date = calendar.date(from: requested) else { return false }
        let actual = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        // Compare only requested fields; Calendar may also populate isLeapMonth.
        return [actual.year, actual.month, actual.day, actual.hour, actual.minute, actual.second]
            .compactMap { $0 } == fields
    }

    private static func disallowedScalar(_ scalar: Unicode.Scalar) -> Bool {
        (0x00...0x1F).contains(scalar.value) || (0x7F...0x9F).contains(scalar.value)
            || (0x2028...0x202E).contains(scalar.value)
            || (0x2066...0x2069).contains(scalar.value)
    }

    private static func visibleScalar(_ scalar: Unicode.Scalar) -> Bool {
        !ecmaWhitespace(scalar) && scalar.properties.generalCategory != .format
    }

    /// Same set as JavaScript String.trim() and /\s/, independent of Foundation's sets.
    private static func ecmaWhitespace(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x0009...0x000D, 0x0020, 0x00A0, 0x1680, 0x2000...0x200A,
             0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
            return true
        default:
            return false
        }
    }
}

private struct AffirmationDocument: Decodable {
    let schemaVersion: Int
    let cadence: String
    let items: [AffirmationItemDocument]
    let configuredAt: String

    init(from decoder: Decoder) throws {
        let values = try strictContainer(decoder, keys: ["schemaVersion", "cadence", "items", "configuredAt"])
        schemaVersion = try values.decode(Int.self, forKey: AffirmationJSONKey("schemaVersion"))
        cadence = try values.decode(String.self, forKey: AffirmationJSONKey("cadence"))
        items = try values.decode([AffirmationItemDocument].self, forKey: AffirmationJSONKey("items"))
        configuredAt = try values.decode(String.self, forKey: AffirmationJSONKey("configuredAt"))
    }
}

private struct AffirmationItemDocument: Decodable {
    let id: String
    let text: String

    init(from decoder: Decoder) throws {
        let values = try strictContainer(decoder, keys: ["id", "text"])
        id = try values.decode(String.self, forKey: AffirmationJSONKey("id"))
        text = try values.decode(String.self, forKey: AffirmationJSONKey("text"))
    }
}

private struct AffirmationJSONKey: CodingKey {
    let stringValue: String
    var intValue: Int? { nil }
    init(_ value: String) { stringValue = value }
    init?(stringValue: String) { self.init(stringValue) }
    init?(intValue: Int) { return nil }
}

private func strictContainer(_ decoder: Decoder, keys: [String]) throws -> KeyedDecodingContainer<AffirmationJSONKey> {
    let values = try decoder.container(keyedBy: AffirmationJSONKey.self)
    guard Set(values.allKeys.map(\.stringValue)) == Set(keys) else {
        throw AffirmationValidationError.invalid("champs non pris en charge")
    }
    return values
}
