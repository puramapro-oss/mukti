import Foundation

private var assertions = 0
private func expect(_ condition: Bool, _ message: String) {
    assertions += 1
    guard condition else { fatalError("FAIL: \(message)") }
}
private func rejects(_ data: Data, _ message: String) {
    do {
        _ = try AffirmationPayload.parse(data)
        fatalError("FAIL: accepted \(message)")
    } catch { assertions += 1 }
}
private func bytes(_ object: [String: Any]) throws -> Data {
    try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
}
private func fixture(_ count: Int = 3, cadence: String = "daily") -> [String: Any] {
    let items = (0..<count).map { value in
        ["id": String(format: "10000000-0000-4000-8000-%012d", value),
         "text": "Je peux avancer à mon rythme. \(value)"]
    }
    return ["schemaVersion": 1, "cadence": cadence, "items": items,
            "configuredAt": "2026-11-11T12:00:00.000Z"]
}
private func date(_ value: String) -> Date {
    ISO8601DateFormatter().date(from: value)!
}
private func scalarDescription(_ value: String) -> String {
    let points = value.unicodeScalars.prefix(12).map { String(format: "U+%04X", $0.value) }.joined(separator: " ")
    return "\(String(reflecting: String(value.prefix(20)))) [\(points); \(value.unicodeScalars.count) scalars]"
}

do {
    let valid = try AffirmationPayload.parse(bytes(fixture()))
    expect(valid.items.count == 3 && valid.cadence == .daily, "valid public payload")
    expect(try AffirmationPayload.parse(valid.encoded()) == valid, "canonical round trip")
    for (field, value) in [("schemaVersion", true as Any), ("schemaVersion", 2 as Any),
                           ("cadence", "hourly" as Any), ("configuredAt", "tomorrow" as Any),
                           ("configuredAt", "2026-11-11" as Any),
                           ("configuredAt", "2026-11-11T12:00:00+02:00" as Any),
                           ("configuredAt", "2026-02-30T12:00:00Z" as Any),
                           ("configuredAt", "2026-11-11T24:00:00Z" as Any),
                           ("configuredAt", "2026-11-11T12:00:60Z" as Any)] {
        var input = fixture()
        input[field] = value
        rejects(try bytes(input), "bad \(field): \(String(reflecting: value))")
    }
    var extra = fixture()
    extra["session"] = "must-never-persist"
    rejects(try bytes(extra), "unknown root field")
    rejects(try bytes(fixture(0)), "empty pool")
    rejects(try bytes(fixture(31)), "oversized pool")
    rejects(Data(repeating: 32, count: AffirmationPayload.maximumBytes + 1), "oversized JSON")
    rejects(Data("[]".utf8), "non-object JSON")
    rejects(Data("{broken".utf8), "malformed JSON")
    for badText in ["", " leading", "trailing ", "line\nbreak", "hidden\u{202E}text", "\u{200D}",
                    "line\u{2028}break", "paragraph\u{2029}break", "\u{FEFF}leading",
                    String(repeating: "🙂", count: 101)] {
        var input = fixture(1)
        input["items"] = [["id": "10000000-0000-4000-8000-000000000000", "text": badText]]
        rejects(try bytes(input), "invalid text: \(scalarDescription(badText))")
    }
    // Foundation JSONSerialization used to erase a leading BOM before validation.
    // Check both literal UTF-8 (above) and the JSON escape emitted by a caller.
    let escapedBOM = #"{"schemaVersion":1,"cadence":"daily","items":[{"id":"10000000-0000-4000-8000-000000000000","text":"\uFEFFleading"}],"configuredAt":"2026-11-11T12:00:00Z"}"#
    rejects(Data(escapedBOM.utf8), "escaped leading U+FEFF")
    for field in ["cadence", "configuredAt"] {
        var input = fixture(1)
        input[field] = "\u{FEFF}" + (input[field] as! String)
        rejects(try bytes(input), "leading U+FEFF in \(field)")
    }
    var bomID = fixture(1)
    bomID["items"] = [["id": "\u{FEFF}10000000-0000-4000-8000-000000000000", "text": "Une phrase publique."]]
    rejects(try bytes(bomID), "leading U+FEFF in id")
    var bomKey = fixture(1)
    bomKey["\u{FEFF}cadence"] = bomKey.removeValue(forKey: "cadence")
    rejects(try bytes(bomKey), "leading U+FEFF in root key")
    let ecmaSpaces: [UInt32] = Array(0x0009...0x000D) + [0x0020, 0x00A0, 0x1680]
        + Array(0x2000...0x200A) + [0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF]
    for point in ecmaSpaces {
        let space = String(Unicode.Scalar(point)!)
        for badText in [space + "Une phrase.", "Une phrase." + space] {
            var input = fixture(1)
            input["items"] = [["id": "10000000-0000-4000-8000-000000000000", "text": badText]]
            rejects(try bytes(input), "untrimmed text: \(scalarDescription(badText))")
        }
    }
    var unicode = fixture(1)
    unicode["items"] = [["id": "10000000-0000-4000-8000-000000000000",
                         "text": String(repeating: "🙂", count: 100)]]
    expect(try AffirmationPayload.parse(bytes(unicode)).items[0].text.unicodeScalars.count == 100,
           "100 Unicode code points, not UTF-16 units")
    let joined = "Un moment en famille. 👩‍👩‍👧‍👦"
    unicode["items"] = [["id": "10000000-0000-4000-8000-000000000000", "text": joined]]
    expect(try AffirmationPayload.parse(bytes(unicode)).items[0].text == joined, "ZWJ emoji preserved")
    let accented = "Je peux prendre soin de moi. e\u{301}"
    unicode["items"] = [["id": "10000000-0000-4000-8000-000000000000", "text": accented]]
    expect(try AffirmationPayload.parse(bytes(unicode)).items[0].text.utf8.elementsEqual(accented.utf8),
           "source Unicode bytes unchanged")
    for allowed in ["\u{200B}Une phrase.", "Une phrase.\u{200D}", "Une\u{FEFF} phrase."] {
        unicode["items"] = [["id": "10000000-0000-4000-8000-000000000000", "text": allowed]]
        expect(try AffirmationPayload.parse(bytes(unicode)).items[0].text.utf8.elementsEqual(allowed.utf8),
               "visible text with permitted format scalar preserved: \(scalarDescription(allowed))")
    }
    for badID in ["custom-10000000-0000-4000-8000-000000000000", "not-a-uuid"] {
        var input = fixture(1)
        input["items"] = [["id": badID, "text": "Une phrase publique."]]
        rejects(try bytes(input), "non-public id shape")
    }
    var duplicate = fixture()
    let first = (duplicate["items"] as! [[String: String]])[0]
    duplicate["items"] = [first, first]
    rejects(try bytes(duplicate), "duplicate item")
    duplicate["items"] = [first, ["id": "10000000-0000-4000-8000-000000000099", "text": first["text"]!]]
    rejects(try bytes(duplicate), "duplicate text under different id")
    duplicate["items"] = [
        ["id": "10000000-0000-4000-8000-000000000000", "text": "Je peux avancer."],
        ["id": "10000000-0000-4000-8000-000000000099", "text": "Ｊe peux avancer."]
    ]
    rejects(try bytes(duplicate), "NFKC-compatible duplicate text")
    var unknownItem = fixture(1)
    unknownItem["items"] = [["id": first["id"]!, "text": first["text"]!, "user_id": "private"]]
    rejects(try bytes(unknownItem), "unknown item field")

    let utc = AffirmationSchedule.calendar(timeZone: TimeZone(secondsFromGMT: 0)!)
    let paris = AffirmationSchedule.calendar(timeZone: TimeZone(identifier: "Europe/Paris")!)
    expect(AffirmationSchedule.ordinal(at: date("1970-01-01T12:00:00Z"), cadence: .daily, calendar: utc) == 0,
           "epoch civil day")
    expect(AffirmationSchedule.ordinal(at: date("1969-12-31T12:00:00Z"), cadence: .daily, calendar: utc) == -1,
           "day before epoch")
    let moments = try AffirmationPayload.parse(bytes(fixture(7, cadence: "moments")))
    let boundaries = ["2026-11-11T05:59:59Z", "2026-11-11T06:00:00Z", "2026-11-11T12:00:00Z",
                      "2026-11-11T19:00:00Z", "2026-11-12T06:00:00Z"].map(date)
    for index in 1..<boundaries.count {
        let previous = AffirmationSchedule.ordinal(at: boundaries[index - 1], cadence: .moments, calendar: paris)
        let current = AffirmationSchedule.ordinal(at: boundaries[index], cadence: .moments, calendar: paris)
        expect(current == previous + 1, "successive local moments increment once")
        expect(AffirmationSchedule.item(at: boundaries[index - 1], payload: moments, calendar: paris)
               != AffirmationSchedule.item(at: boundaries[index], payload: moments, calendar: paris),
               "no adjacent repeats")
    }
    let night = date("2026-11-12T03:00:00Z")
    expect(AffirmationSchedule.item(at: night, payload: moments, calendar: paris)
           == AffirmationSchedule.item(at: boundaries[3], payload: moments, calendar: paris),
           "night keeps previous evening")
    for anchor in ["2026-03-28T23:30:00Z", "2026-10-24T23:30:00Z"] {
        let start = date(anchor)
        let timeline = AffirmationSchedule.dates(after: start, cadence: .moments, calendar: paris)
        expect(timeline.first == start, "timeline starts now")
        expect(timeline == timeline.sorted() && Set(timeline).count == timeline.count, "unique sorted entries")
        expect(timeline.dropFirst().allSatisfy { [7, 13, 20].contains(paris.component(.hour, from: $0)) },
               "DST preserves local moment hours")
    }
    let midnightDates = AffirmationSchedule.dates(after: date("2026-03-28T12:00:00Z"), cadence: .daily, calendar: paris)
    expect(midnightDates.dropFirst().allSatisfy { paris.component(.hour, from: $0) == 0 }, "DST local midnight")
    let tokyo = AffirmationSchedule.calendar(timeZone: TimeZone(identifier: "Asia/Tokyo")!)
    let losAngeles = AffirmationSchedule.calendar(timeZone: TimeZone(identifier: "America/Los_Angeles")!)
    let instant = date("2026-11-11T23:30:00Z")
    expect(AffirmationSchedule.ordinal(at: instant, cadence: .daily, calendar: tokyo)
           == AffirmationSchedule.ordinal(at: instant, cadence: .daily, calendar: losAngeles) + 1,
           "date follows current time zone")
    expect(AffirmationSchedule.item(at: date("1969-12-31T12:00:00Z"), payload: valid, calendar: utc).id
           == valid.items[2].id, "positive modulo before epoch")

    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = AffirmationStore(testDirectory: directory)
    expect(try store.load() == nil, "unconfigured storage")
    try store.save(String(data: try valid.encoded(), encoding: .utf8)!)
    expect(try store.load() == valid, "atomic write then restore")
    do { try store.save("{broken"); fatalError("invalid save accepted") } catch { assertions += 1 }
    expect(try store.load() == valid, "invalid save preserves prior configuration")
    var oldSchema = fixture()
    oldSchema["schemaVersion"] = 2
    let damagedSnapshots = [("malformed JSON", Data("{broken".utf8)),
                            ("unsupported schema", try bytes(oldSchema))]
    let cacheURL = directory.appendingPathComponent(AffirmationStore.key)
    for (reason, data) in damagedSnapshots {
        try data.write(to: cacheURL)
        expect(try store.load() == nil, "\(reason) cache is unconfigured and recoverable")
        try store.save(String(data: try valid.encoded(), encoding: .utf8)!)
        expect(try store.load() == valid, "save repairs \(reason) cache")
    }
    try store.clear()
    try store.clear()
    expect(try store.load() == nil, "clear is effective and idempotent")
    try FileManager.default.createDirectory(at: cacheURL, withIntermediateDirectories: false)
    do { _ = try store.load(); fatalError("I/O failure was hidden as an unconfigured cache") }
    catch { assertions += 1 }
    print("PASS: \(assertions) Foundation payload, schedule and storage assertions.")
} catch {
    fatalError("Unexpected test error: \(error)")
}
