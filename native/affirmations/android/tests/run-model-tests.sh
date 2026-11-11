#!/bin/sh
set -eu
widget_android_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
widget_test_classes=$(mktemp -d "${TMPDIR:-/tmp}/mukti-widget-model.XXXXXX")
trap 'rm -rf "$widget_test_classes"' EXIT HUP INT TERM
javac -encoding UTF-8 -d "$widget_test_classes" \
    "$widget_android_dir/java/dev/purama/mukti/widgets/StrictWidgetJson.java" \
    "$widget_android_dir/java/dev/purama/mukti/widgets/AffirmationWidgetModel.java" \
    "$widget_android_dir/tests/AffirmationWidgetModelTest.java"
java -cp "$widget_test_classes" dev.purama.mukti.widgets.AffirmationWidgetModelTest
