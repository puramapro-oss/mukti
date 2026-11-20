#!/usr/bin/env python3
"""Run the existing Harmonie software checks with fresh, inspectable evidence.

No browser, physical audio, provider, npm command or deployment is exercised.
The tested product files and their historical reports are never overwritten.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
DSP_CASES = {
    "a440-to-a432", "a880-to-a864", "high-12000-strict-ratio",
    "stereo-440-660", "already-432-no-double-shift", "silence",
    "tempo-pulses", "stop-flush",
}
EXAMPLE_FILES = {"MUKTI_432Hz_son_pur.wav", "MUKTI_432Hz_melodie_et_tonalite.wav"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def source_hashes():
    result = {}
    for directory in ("prototypes/harmonie", "tools/harmonie"):
        for path in sorted((ROOT / directory).rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                result[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
    require(result, "No Harmonie source files found")
    return result


def validate_lifecycle(path):
    root = ET.parse(path).getroot()
    cases = list(root.iter("testcase"))
    require(len(cases) >= 6, "Fewer than the six existing lifecycle cases were executed")
    require(not any(list(root.iter(tag)) for tag in ("failure", "error", "skipped")),
            "Lifecycle report contains a failed, skipped or cancelled case")
    return {"passed": len(cases), "scope": "Explicit Web Audio doubles; no real browser"}


def validate_dsp(path):
    data = json.loads(path.read_text())
    checks = data.get("checks", [])
    names = [check.get("test") for check in checks]
    require(data.get("all_passed") is True, "DSP report is not successful")
    require(len(names) == len(set(names)), "Duplicate DSP result names")
    require(DSP_CASES.issubset(set(names)), "An existing DSP case is missing")
    require(all(check.get("status") == "PASS" for check in checks), "A DSP case failed")
    return {"passed": len(checks), "scope": "Real vendored WASM; independent PCM analysis"}


def validate_retune(path):
    data = json.loads(path.read_text())
    require(data.get("status") == "PASS", "Retune report is not successful")
    require(isinstance(data.get("tests_run"), int) and data["tests_run"] >= 11,
            "Fewer than the eleven existing conversion cases were executed")
    require(all(data.get(key) == [] for key in ("failures", "errors", "skipped")),
            "Conversion report contains a failure, error or skip")
    return {"passed": data["tests_run"], "scope": "Real FFmpeg/Rubber Band, synthetic media"}


def validate_examples(path):
    data = json.loads(path.read_text())
    checks = data.get("checks", [])
    names = [check.get("filename") for check in checks]
    require(data.get("status") == "PASS", "Example report is not successful")
    require(len(names) == len(set(names)) and EXAMPLE_FILES.issubset(set(names)),
            "An existing listening example is missing or repeated")
    require(all(check.get("status") == "PASS" for check in checks), "An example failed")
    return {"passed": len(checks), "scope": "Generated PCM files only"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path,
                        help="New directory for this run; an existing directory is refused")
    options = parser.parse_args()
    output = options.output.resolve()
    require(not output.exists(), "Evidence directory already exists; refuse stale evidence")
    require(not output.is_relative_to(ROOT), "Evidence must be written outside the checkout")
    output.mkdir(parents=True)
    summary = {
        "schema_version": 1,
        "started_utc": datetime.now(timezone.utc).isoformat(),
        "status": "FAIL",
        "commands": [],
        "groups": {},
        "not_tested": [
            "Real browser/Chrome/AudioWorklet scheduling",
            "Physical sound, devices, Bluetooth, iOS and Android",
            "Production app, providers, signing and deployment",
            "Dependency vulnerability audit",
        ],
        "github": {key: os.environ.get(key) for key in
                   ("GITHUB_SHA", "GITHUB_HEAD_REF", "GITHUB_BASE_REF", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT")},
    }
    before = None
    environment = dict(os.environ)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    environment.pop("PYTHONOPTIMIZE", None)

    def run(name, argv, timeout=120):
        started = time.monotonic()
        stdout_path, stderr_path = output / (name + ".stdout.log"), output / (name + ".stderr.log")
        record = {"name": name, "command": argv, "cwd": str(ROOT), "timeout_seconds": timeout}
        with stdout_path.open("wb") as stdout, stderr_path.open("wb") as stderr:
            process = subprocess.Popen(argv, cwd=ROOT, env=environment, stdout=stdout, stderr=stderr,
                                       start_new_session=(os.name == "posix"))
            try:
                returncode = process.wait(timeout=timeout)
            except BaseException:
                if os.name == "posix":
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait()
                record.update(exit_code=process.returncode, elapsed_seconds=time.monotonic() - started,
                              interrupted_or_timed_out=True)
                summary["commands"].append(record)
                raise
        record.update(exit_code=returncode, elapsed_seconds=time.monotonic() - started,
                      stdout=stdout_path.name, stderr=stderr_path.name)
        summary["commands"].append(record)
        require(returncode == 0, name + " returned " + str(returncode))
        return stdout_path

    try:
        require(sys.flags.optimize == 0, "Python optimization may disable existing test assertions")
        before = source_hashes()
        summary["source_sha256_before"] = before
        summary["environment"] = {
            "python": sys.version,
            "numpy": importlib.metadata.version("numpy"),
            "scipy": importlib.metadata.version("scipy"),
        }
        summary["environment"]["node"] = run("node-version", ["node", "--version"]).read_text().strip()
        summary["environment"]["ffmpeg"] = run("ffmpeg-version", ["ffmpeg", "-version"]).read_text().splitlines()[0]
        summary["environment"]["ffprobe"] = run("ffprobe-version", ["ffprobe", "-version"]).read_text().splitlines()[0]
        filters = run("ffmpeg-filters", ["ffmpeg", "-hide_banner", "-filters"]).read_text()
        encoders = run("ffmpeg-encoders", ["ffmpeg", "-hide_banner", "-encoders"]).read_text()
        require(any(line.split()[1:2] == ["rubberband"] for line in filters.splitlines()), "rubberband filter missing")
        require(any(line.split()[1:2] == ["libx264"] for line in encoders.splitlines()), "libx264 encoder missing")

        provenance_path = ROOT / "prototypes/harmonie/vendor/provenance.json"
        provenance = json.loads(provenance_path.read_text())
        vendor = ROOT / "prototypes/harmonie/vendor/SignalsmithStretch-1.3.2.js"
        vendor_bytes = vendor.read_bytes()
        require(len(vendor_bytes) == provenance["bytes"], "Vendor length differs from provenance")
        require(hashlib.sha256(vendor_bytes).hexdigest() == provenance["sha256"], "Vendor SHA-256 mismatch")
        require(hashlib.sha1(b"blob " + str(len(vendor_bytes)).encode() + b"\0" + vendor_bytes).hexdigest()
                == provenance["git_blob_sha1"], "Vendor Git blob mismatch")
        summary["vendor_provenance"] = {"status": "PASS", "sha256": provenance["sha256"],
                                        "git_blob_sha1": provenance["git_blob_sha1"]}

        junit = run("lifecycle", ["node", "--test", "--test-reporter=junit",
                                 "prototypes/harmonie/tests/lifecycle.test.mjs"])
        summary["groups"]["lifecycle"] = validate_lifecycle(junit)

        dsp_directory = output / "dsp-pcm"
        run("dsp-render", ["node", "prototypes/harmonie/tests/render-dsp-cases.cjs", str(dsp_directory)])
        dsp_report = output / "dsp-report.json"
        run("dsp-analysis", [sys.executable, "prototypes/harmonie/tests/verify-dsp.py",
                             str(dsp_directory), str(dsp_report)])
        summary["groups"]["dsp"] = validate_dsp(dsp_report)

        retune_report = output / "retune-report.json"
        run("retune", [sys.executable, "tools/harmonie/tests/test_retune.py", "--report", str(retune_report)], 180)
        summary["groups"]["retune"] = validate_retune(retune_report)

        examples_directory = output / "examples-pcm"
        run("examples-generate", [sys.executable, "tools/harmonie/generate_examples.py", str(examples_directory)])
        examples_report = output / "examples-report.json"
        run("examples-analysis", [sys.executable, "tools/harmonie/tests/test_examples.py",
                                  str(examples_directory), "--report", str(examples_report)])
        summary["groups"]["examples"] = validate_examples(examples_report)
        summary["status"] = "PASS"
    except Exception as error:
        summary["error"] = type(error).__name__ + ": " + str(error)
    finally:
        if before is not None:
            after = source_hashes()
            summary["source_sha256_after"] = after
            summary["source_files_unchanged"] = before == after
            if before != after:
                summary["status"] = "FAIL"
                summary["source_integrity_error"] = "An existing Harmonie file changed during the run"
        summary["finished_utc"] = datetime.now(timezone.utc).isoformat()
        (output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": summary["status"], "groups": summary["groups"],
                      "summary": str(output / "summary.json"), "error": summary.get("error")},
                     ensure_ascii=False))
    return 0 if summary["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
