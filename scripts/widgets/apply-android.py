#!/usr/bin/env python3
"""Apply the local affirmation widget to a generated Capacitor 7 Android project.

Run after `cap add android` / `cap sync android`. All compatibility and ownership
checks finish before any write. Existing unrelated source is never replaced.
"""

from __future__ import annotations

import argparse
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import xml.etree.ElementTree as ET

REPOSITORY = Path(__file__).resolve().parents[2]
SOURCE = REPOSITORY / "native" / "affirmations" / "android"
ANDROID_NS = "http://schemas.android.com/apk/res/android"
APP_ID = "dev.purama.mukti"
WIDGET_PACKAGE = APP_ID + ".widgets"
PROVIDER = WIDGET_PACKAGE + ".AffirmationWidgetProvider"
TIME_RECEIVER = WIDGET_PACKAGE + ".AffirmationWidgetTimeReceiver"
MARKER = ".purama-affirmation-widget.json"


class CompatibilityError(Exception):
    pass


def attribute(name: str) -> str:
    return "{" + ANDROID_NS + "}" + name


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise CompatibilityError(f"Cannot read valid JSON: {path}") from error
    if not isinstance(value, dict):
        raise CompatibilityError(f"Expected an object: {path}")
    return value


def require_plain_path(path: Path, root: Path) -> None:
    try:
        path.relative_to(root)
    except ValueError as error:
        raise CompatibilityError(f"Path is outside the Android project: {path}") from error
    current = path
    while current != root:
        if current.is_symlink():
            raise CompatibilityError(f"Refusing a symbolic link: {current}")
        current = current.parent


def check_project(project: Path) -> None:
    if not project.is_dir():
        raise CompatibilityError("Android project is missing; run cap add/sync android first.")
    package = read_json(REPOSITORY / "package.json")
    dependencies = package.get("dependencies")
    version = dependencies.get("@capacitor/android", "") if isinstance(dependencies, dict) else ""
    if not isinstance(version, str) or not re.fullmatch(r"[~^]?7\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", version):
        raise CompatibilityError("This installer supports an explicit Capacitor Android 7.x dependency only.")
    config_path = project / "app/src/main/assets/capacitor.config.json"
    require_plain_path(config_path, project)
    config = read_json(config_path)
    server = config.get("server")
    url = server.get("url") if isinstance(server, dict) else None
    if config.get("appId") != APP_ID or not isinstance(url, str) or url.rstrip("/") != "https://mukti.purama.dev":
        raise CompatibilityError("Expected dev.purama.mukti and the exact HTTPS MUKTI server URL; run cap sync first.")
    gradle = project / "app/build.gradle"
    require_plain_path(gradle, project)
    try:
        build = gradle.read_text(encoding="utf-8")
    except OSError as error:
        raise CompatibilityError("Expected a generated Groovy app/build.gradle.") from error
    for setting in ("namespace", "applicationId"):
        if not re.search(r"\b" + setting + r"\s*(?:=\s*)?[\"']dev\.purama\.mukti[\"']", build):
            raise CompatibilityError(f"Unexpected Android {setting}; no files were changed.")


def load_ownership(project: Path) -> dict[str, str]:
    path = project / MARKER
    require_plain_path(path, project)
    if not path.exists():
        return {}
    marker = read_json(path)
    files = marker.get("files")
    if marker.get("schemaVersion") != 1 or marker.get("appId") != APP_ID or not isinstance(files, dict):
        raise CompatibilityError("Widget ownership marker is incompatible.")
    if any(not isinstance(name, str) or not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value)
           for name, value in files.items()):
        raise CompatibilityError("Widget ownership marker is invalid.")
    return files


def manifest_bytes(project: Path) -> bytes:
    path = project / "app/src/main/AndroidManifest.xml"
    require_plain_path(path, project)
    try:
        original = path.read_bytes()
        # Parse the same snapshot twice, with explicit ownership of the stream.
        # Python 3.10–3.12 lack iterator.close(); 3.13+ expose it and expect closure.
        with BytesIO(original) as stream:
            namespaces = ET.iterparse(stream, events=("start-ns",))
            try:
                for _event, (prefix, uri) in namespaces:
                    ET.register_namespace(prefix or "", uri)
            finally:
                close = getattr(namespaces, "close", None)
                if close is not None:
                    close()
        root = ET.fromstring(original, parser=ET.XMLParser(target=ET.TreeBuilder(insert_comments=True)))
    except (OSError, ET.ParseError, ValueError) as error:
        raise CompatibilityError("Cannot read the generated AndroidManifest.xml.") from error
    if root.tag != "manifest":
        raise CompatibilityError("Android manifest root is invalid.")
    applications = root.findall("application")
    if len(applications) != 1:
        raise CompatibilityError("Expected exactly one Android application.")
    app = applications[0]
    main = [node for node in app.findall("activity")
            if node.get(attribute("name")) in (".MainActivity", APP_ID + ".MainActivity")]
    if len(main) != 1:
        raise CompatibilityError("Expected the generated MUKTI MainActivity in the manifest.")
    changed = False
    permission = "android.permission.RECEIVE_BOOT_COMPLETED"
    if not any(node.get(attribute("name")) == permission for node in root.findall("uses-permission")):
        root.insert(0, ET.Element("uses-permission", {attribute("name"): permission}))
        changed = True

    receivers = [
        (PROVIDER, ["android.appwidget.action.APPWIDGET_UPDATE"], True),
        (TIME_RECEIVER, ["android.intent.action.BOOT_COMPLETED", "android.intent.action.TIME_SET",
                         "android.intent.action.TIMEZONE_CHANGED"], False),
    ]
    for name, actions, widget in receivers:
        expected = {attribute("name"): name, attribute("exported"): "false"}
        if widget:
            expected[attribute("label")] = "@string/purama_affirmation_widget_name"
        matches = [node for node in app.findall("receiver")
                   if (APP_ID + node.get(attribute("name"), "") if node.get(attribute("name"), "").startswith(".")
                       else node.get(attribute("name"))) == name]
        if len(matches) > 1:
            raise CompatibilityError(f"Duplicate receiver: {name}")
        if matches:
            receiver = matches[0]
            if dict(receiver.attrib) != expected:
                raise CompatibilityError(f"Existing receiver attributes differ: {name}")
            filters = receiver.findall("intent-filter")
            actual_actions = [node.get(attribute("name")) for node in receiver.findall("intent-filter/action")]
            if len(filters) != 1 or sorted(actual_actions) != sorted(actions) or len(filters[0]) != len(actions):
                raise CompatibilityError(f"Existing receiver actions differ: {name}")
            metadata = receiver.findall("meta-data")
            expected_metadata = {attribute("name"): "android.appwidget.provider",
                                 attribute("resource"): "@xml/purama_affirmation_widget_info"}
            if (widget and (len(metadata) != 1 or dict(metadata[0].attrib) != expected_metadata)) or (not widget and metadata):
                raise CompatibilityError(f"Existing receiver metadata differ: {name}")
            if len(receiver) != (2 if widget else 1):
                raise CompatibilityError(f"Unexpected receiver child: {name}")
            continue
        receiver = ET.SubElement(app, "receiver", expected)
        action_filter = ET.SubElement(receiver, "intent-filter")
        for action in actions:
            ET.SubElement(action_filter, "action", {attribute("name"): action})
        if widget:
            ET.SubElement(receiver, "meta-data", {
                attribute("name"): "android.appwidget.provider",
                attribute("resource"): "@xml/purama_affirmation_widget_info",
            })
        changed = True
    if not changed:
        return original
    ET.indent(root, space="    ")
    return b'<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(root, encoding="utf-8") + b"\n"


def generated_main_activity(value: bytes) -> bool:
    try:
        text = value.decode("utf-8")
    except UnicodeDecodeError:
        return False
    text = re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.S)
    return bool(re.fullmatch(
        r"\s*package\s+dev\.purama\.mukti\s*;\s*"
        r"import\s+com\.getcapacitor\.BridgeActivity\s*;\s*"
        r"public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*}\s*", text))


def build_plan(project: Path) -> tuple[dict[Path, bytes], dict[str, str]]:
    check_project(project)
    ownership = load_ownership(project)
    plan: dict[Path, bytes] = {}
    managed: dict[str, str] = {}
    required = [
        "java/dev/purama/mukti/widgets/StrictWidgetJson.java",
        "java/dev/purama/mukti/widgets/AffirmationWidgetModel.java",
        "java/dev/purama/mukti/widgets/AffirmationWidgetStore.java",
        "java/dev/purama/mukti/widgets/AffirmationWidgetPlugin.java",
        "java/dev/purama/mukti/widgets/AffirmationWidgetProvider.java",
        "java/dev/purama/mukti/widgets/AffirmationWidgetTimeReceiver.java",
        "res/layout/purama_affirmation_widget.xml",
        "res/drawable/purama_affirmation_widget_background.xml",
        "res/xml/purama_affirmation_widget_info.xml",
        "res/values/purama_affirmation_widget_strings.xml",
        "MainActivity.java.template",
    ]
    if any(not (SOURCE / name).is_file() for name in required):
        raise CompatibilityError("The checked-in Android widget sources are incomplete.")
    paths = [(path, project / "app/src/main" / path.relative_to(SOURCE))
             for folder in ("java", "res") for path in sorted((SOURCE / folder).rglob("*")) if path.is_file()]
    paths.append((SOURCE / "MainActivity.java.template", project / "app/src/main/java/dev/purama/mukti/MainActivity.java"))
    if not paths or not (SOURCE / "MainActivity.java.template").is_file():
        raise CompatibilityError("The checked-in Android widget sources are incomplete.")
    for source, destination in paths:
        if source.is_symlink():
            raise CompatibilityError(f"Refusing a linked source: {source}")
        require_plain_path(destination, project)
        data = source.read_bytes()
        relative = destination.relative_to(project).as_posix()
        if destination.exists():
            current = destination.read_bytes()
            is_default = destination.name == "MainActivity.java" and generated_main_activity(current)
            is_owned = ownership.get(relative) == digest(current)
            if current != data and not is_default and not is_owned:
                raise CompatibilityError(f"Existing source was not generated by this installer or was modified: {relative}")
        elif destination.name == "MainActivity.java":
            raise CompatibilityError("MainActivity.java is missing; refusing to fabricate an application entry point.")
        plan[destination] = data
        managed[relative] = digest(data)
    plan[project / "app/src/main/AndroidManifest.xml"] = manifest_bytes(project)
    marker = {"schemaVersion": 1, "appId": APP_ID, "files": managed}
    plan[project / MARKER] = (json.dumps(marker, indent=2, sort_keys=True) + "\n").encode("utf-8")
    return plan, managed


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(prefix=".widget-", dir=path.parent, delete=False) as file:
        temporary = Path(file.name)
        try:
            file.write(data)
            file.flush()
            os.fsync(file.fileno())
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    try:
        if path.exists():
            os.chmod(temporary, path.stat().st_mode & 0o777)
        else:
            os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def apply(project: Path, check: bool = False) -> int:
    project = project.resolve()
    plan, _managed = build_plan(project)
    changes = [(path, value) for path, value in plan.items() if not path.is_file() or path.read_bytes() != value]
    if check:
        if changes:
            print("Widget integration is missing or stale: " + ", ".join(path.relative_to(project).as_posix() for path, _ in changes), file=sys.stderr)
            return 1
        print("PASS: Android widget sources, registration and manifest match.")
        return 0
    for path, value in changes:
        write_atomic(path, value)
    print(f"Android widget integration prepared ({len(changes)} files changed). Native build/device tests are separate.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=REPOSITORY / "android", help="Generated Android project directory")
    parser.add_argument("--check", action="store_true", help="Verify without writing")
    args = parser.parse_args()
    try:
        return apply(args.project, args.check)
    except (CompatibilityError, OSError) as error:
        print(f"BLOCKED: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
