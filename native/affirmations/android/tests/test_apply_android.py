"""Installer tests use disposable generated-project fixtures; never the user's Android project."""

from contextlib import redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
SPEC = importlib.util.spec_from_file_location("apply_android", ROOT / "scripts/widgets/apply-android.py")
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)

MAIN = """package dev.purama.mukti;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {}
"""
MANIFEST = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:label="@string/app_name">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <provider android:name="androidx.core.content.FileProvider" android:authorities="${applicationId}.fileprovider" android:exported="false" />
    </application>
</manifest>
"""


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="mukti-widget-installer-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.project = self.root / "android"
        self.write(self.root / "package.json", json.dumps({"dependencies": {"@capacitor/android": "^7.6.2"}}))
        self.write(self.project / "app/build.gradle", "android { namespace 'dev.purama.mukti'\n defaultConfig { applicationId 'dev.purama.mukti' } }")
        self.write(self.project / "app/src/main/assets/capacitor.config.json", json.dumps({"appId": "dev.purama.mukti", "server": {"url": "https://mukti.purama.dev"}}))
        self.activity = self.project / "app/src/main/java/dev/purama/mukti/MainActivity.java"
        self.manifest = self.project / "app/src/main/AndroidManifest.xml"
        self.write(self.activity, MAIN)
        self.write(self.manifest, MANIFEST)
        patcher = patch.object(installer, "REPOSITORY", self.root)
        patcher.start()
        self.addCleanup(patcher.stop)

    @staticmethod
    def write(path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def run_apply(self, check=False):
        with redirect_stdout(io.StringIO()):
            return installer.apply(self.project, check)

    def snapshot(self):
        return {path.relative_to(self.project).as_posix(): path.read_bytes()
                for path in self.project.rglob("*") if path.is_file()}

    def rejected_without_write(self):
        before = self.snapshot()
        with self.assertRaises(installer.CompatibilityError):
            self.run_apply()
        self.assertEqual(before, self.snapshot())

    def test_idempotent_and_registration_before_super(self):
        self.assertEqual(self.run_apply(), 0)
        first = self.snapshot()
        self.assertEqual(self.run_apply(), 0)
        self.assertEqual(first, self.snapshot())
        self.assertEqual(self.run_apply(check=True), 0)
        activity = self.activity.read_text()
        self.assertLess(activity.index("registerPlugin("), activity.index("super.onCreate("))
        self.assertIn("AffirmationWidgetProvider.DESTINATION", activity)
        manifest = self.manifest.read_text()
        self.assertEqual(manifest.count('android:name="dev.purama.mukti.widgets.AffirmationWidgetProvider"'), 1)
        self.assertEqual(manifest.count('android:name="android.permission.RECEIVE_BOOT_COMPLETED"'), 1)
        self.assertIn("androidx.core.content.FileProvider", manifest)
        self.assertIn("android.permission.INTERNET", manifest)

    def test_custom_activity_preserved(self):
        self.write(self.activity, MAIN.replace("{}", "{ public void customLogic() {} }"))
        self.rejected_without_write()

    def test_edit_to_managed_activity_is_preserved(self):
        self.run_apply()
        self.write(self.activity, self.activity.read_text() + "\n// Later user change\n")
        self.rejected_without_write()

    def test_unowned_resource_collision_preserved(self):
        self.write(self.project / "app/src/main/res/layout/purama_affirmation_widget.xml", "<existing-layout />")
        self.rejected_without_write()

    def test_missing_activity_is_not_fabricated(self):
        self.activity.unlink()
        self.rejected_without_write()

    def test_other_origin_refused(self):
        config = self.project / "app/src/main/assets/capacitor.config.json"
        self.write(config, json.dumps({"appId": "dev.purama.mukti", "server": {"url": "https://other.example"}}))
        self.rejected_without_write()

    def test_other_app_id_refused(self):
        config = self.project / "app/src/main/assets/capacitor.config.json"
        self.write(config, json.dumps({"appId": "dev.purama.other", "server": {"url": "https://mukti.purama.dev"}}))
        self.rejected_without_write()

    def test_bad_server_type_refused(self):
        config = self.project / "app/src/main/assets/capacitor.config.json"
        self.write(config, json.dumps({"appId": "dev.purama.mukti", "server": []}))
        self.rejected_without_write()

    def test_other_capacitor_major_refused(self):
        self.write(self.root / "package.json", json.dumps({"dependencies": {"@capacitor/android": "^8.0.0"}}))
        self.rejected_without_write()

    def test_conflicting_receiver_export_refused(self):
        self.run_apply()
        content = self.manifest.read_text()
        content = content.replace('android:name="dev.purama.mukti.widgets.AffirmationWidgetProvider" android:exported="false"',
                                  'android:name="dev.purama.mukti.widgets.AffirmationWidgetProvider" android:exported="true"')
        self.write(self.manifest, content)
        self.rejected_without_write()

    def test_duplicate_receiver_refused(self):
        duplicate = '<receiver android:name="dev.purama.mukti.widgets.AffirmationWidgetProvider" android:exported="false" />'
        self.write(self.manifest, MANIFEST.replace("</application>", duplicate + duplicate + "</application>"))
        self.rejected_without_write()

    def test_symlink_destination_refused(self):
        original = self.activity.read_bytes()
        self.activity.unlink()
        external = self.root / "outside.java"
        external.write_bytes(original)
        self.activity.symlink_to(external)
        self.rejected_without_write()
        self.assertEqual(external.read_bytes(), original)

    def check_parser_resources(self, fail_namespace=False):
        original_iterparse = installer.ET.iterparse
        opened = []

        class ClosingIterator:
            """Exercise Python 3.13+ close semantics while parsing real XML on older runtimes."""
            def __init__(self, source, **kwargs):
                self.source = source
                self.iterator = original_iterparse(source, **kwargs)
                self.closed = False
                opened.append(self)

            def __iter__(self):
                return self

            def __next__(self):
                return next(self.iterator)

            def close(self):
                self.closed = True
                close = getattr(self.iterator, "close", None)
                if close is not None:
                    close()

        with patch.object(installer.ET, "iterparse", ClosingIterator):
            if fail_namespace:
                with patch.object(installer.ET, "register_namespace", side_effect=ValueError("invalid namespace")):
                    self.rejected_without_write()
            else:
                self.run_apply()
        self.assertTrue(opened)
        for parser in opened:
            self.assertTrue(parser.closed, "The iterparse iterator must be closed explicitly when supported.")
            self.assertTrue(getattr(parser.source, "closed", False), "The owned XML stream must always be closed.")

    def test_xml_resources_closed_after_success(self):
        self.check_parser_resources()

    def test_xml_resources_closed_after_namespace_error(self):
        self.check_parser_resources(fail_namespace=True)


if __name__ == "__main__":
    unittest.main()
