import Foundation

enum AffirmationStoreError: LocalizedError {
    case missingAppGroup

    var errorDescription: String? {
        "Le groupe partagé du widget MUKTI est indisponible. Vérifie les droits App Group de cette version."
    }
}

/// One bounded, atomic JSON file; no session, account, token or private affirmation.
/// The key is also the filename in the shared App Group container.
struct AffirmationStore {
    static let appGroup = "group.dev.purama.mukti.affirmations"
    static let key = "affirmationWidget.v1"
    static let widgetKind = "dev.purama.mukti.affirmations"
    private let testDirectory: URL?

    init(testDirectory: URL? = nil) {
        self.testDirectory = testDirectory
    }

    func load() throws -> AffirmationPayload? {
        let location = try fileURL()
        guard FileManager.default.fileExists(atPath: location.path) else { return nil }
        let handle = try FileHandle(forReadingFrom: location)
        defer { try? handle.close() }
        let bytes = try handle.read(upToCount: AffirmationPayload.maximumBytes + 1) ?? Data()
        // A damaged or outdated snapshot is unconfigured, so the user can replace
        // it. App Group and I/O failures above must still surface to the caller.
        return try? AffirmationPayload.parse(bytes)
    }

    func save(_ input: String) throws {
        guard input.utf8.count <= AffirmationPayload.maximumBytes else {
            throw AffirmationValidationError.invalid("taille maximale de 20 Kio")
        }
        let payload = try AffirmationPayload.parse(Data(input.utf8))
        // Re-encode validated fields: never persist unknown/duplicate JSON fields.
        let data = try payload.encoded()
        let location = try fileURL()
        #if os(iOS)
        try data.write(to: location, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: location, options: .atomic)
        #endif
    }

    func clear() throws {
        let location = try fileURL()
        guard FileManager.default.fileExists(atPath: location.path) else { return }
        try FileManager.default.removeItem(at: location)
    }

    private func fileURL() throws -> URL {
        if let directory = testDirectory {
            return directory.appendingPathComponent(Self.key, isDirectory: false)
        }
        #if canImport(Darwin)
        guard let directory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: Self.appGroup
        ) else { throw AffirmationStoreError.missingAppGroup }
        return directory.appendingPathComponent(Self.key, isDirectory: false)
        #else
        throw AffirmationStoreError.missingAppGroup
        #endif
    }
}
