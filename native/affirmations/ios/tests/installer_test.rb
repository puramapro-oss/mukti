#!/usr/bin/env ruby
require 'digest'
require 'fileutils'
require 'open3'
require 'rbconfig'
require 'tmpdir'
require 'xcodeproj'

root = File.expand_path('../../../..', __dir__)
installer = File.join(root, 'scripts/widgets/apply-ios.rb')
def check(condition, label)
  raise "FAIL: #{label}" unless condition
end

def fixture(directory, controller = 'CAPBridgeViewController')
  FileUtils.mkdir_p(File.join(directory, 'App/Base.lproj'))
  project = Xcodeproj::Project.new(File.join(directory, 'App.xcodeproj'))
  target = project.new_target(:application, 'App', :ios, '15.0')
  target.build_configurations.each do |configuration|
    configuration.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'dev.purama.mukti'
    configuration.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/Existing.entitlements'
  end
  project.save
  Xcodeproj::Plist.write_to_path({ 'CFBundleIdentifier' => '$(PRODUCT_BUNDLE_IDENTIFIER)',
                                 'PreserveMe' => 'existing-value' }, File.join(directory, 'App/Info.plist'))
  Xcodeproj::Plist.write_to_path({ 'aps-environment' => 'development',
                                 'com.apple.security.application-groups' => ['group.existing'] },
                               File.join(directory, 'App/Existing.entitlements'))
  File.write(File.join(directory, 'App/Base.lproj/Main.storyboard'),
             %(<document><scenes><scene><objects><viewController id="root" customClass="#{controller}" customModule="Capacitor"/></objects></scene></scenes></document>))
end

Dir.mktmpdir('mukti-ios-installer-test') do |temporary|
  project_directory = File.join(temporary, 'working')
  fixture(project_directory)
  output, error, status = Open3.capture3(RbConfig.ruby, installer, project_directory)
  check(status.success?, "first install: #{output} #{error}")
  tracked = ['App.xcodeproj/project.pbxproj', 'App/Info.plist', 'App/Base.lproj/Main.storyboard',
             '.mukti-affirmations-install.json']
  managed = Dir.glob(File.join(project_directory, '**/*'), File::FNM_DOTMATCH)
               .select { |path| File.file?(path) }
               .map { |path| path.delete_prefix(project_directory + '/') }.sort
  first = managed.to_h { |relative| [relative, File.binread(File.join(project_directory, relative))] }
  output, error, status = Open3.capture3(RbConfig.ruby, installer, project_directory)
  check(status.success?, "second install: #{output} #{error}")
  changed = first.keys.reject { |relative| File.binread(File.join(project_directory, relative)) == first[relative] }
  check(changed.empty?, "second install is byte-idempotent (changed: #{changed.join(', ')})")
  output, error, status = Open3.capture3(RbConfig.ruby, installer, project_directory)
  check(status.success?, "third install: #{output} #{error}")
  check(first.all? { |relative, bytes| File.binread(File.join(project_directory, relative)) == bytes },
        'third install preserves every generated file byte for byte')
  project = Xcodeproj::Project.open(File.join(project_directory, 'App.xcodeproj'))
  app = project.targets.find { |target| target.name == 'App' }
  widget = project.targets.find { |target| target.name == 'MuktiAffirmationWidget' }
  check(project.targets.length == 2 && widget, 'exactly one new extension target')
  check(app.source_build_phase.files.length == 5 && widget.source_build_phase.files.length == 4,
        'native sources have exact target membership')
  check(app.dependencies.length == 1 && app.copy_files_build_phases.length == 1,
        'single dependency and embedding phase')
  check(app.copy_files_build_phases.first.files.length == 1, 'extension embedded once')
  check(app.build_configurations.all? { |c| c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] == '15.0' },
        'original app deployment target preserved')
  entitlements = Xcodeproj::Plist.read_from_path(File.join(project_directory, 'App/Affirmations/Entitlements/Debug.entitlements'))
  check(entitlements['aps-environment'] == 'development', 'existing push entitlement preserved')
  check(entitlements['com.apple.security.application-groups'] == ['group.existing', 'group.dev.purama.mukti.affirmations'],
        'App Group merged without dropping existing groups')
  info = Xcodeproj::Plist.read_from_path(File.join(project_directory, 'App/Info.plist'))
  check(info['PreserveMe'] == 'existing-value' && info['CFBundleURLTypes'].length == 1,
        'Info.plist preserved and URL scheme not duplicated')

  modified = File.join(project_directory, 'App/Affirmations/App/AffirmationWidgetPlugin.swift')
  File.open(modified, 'a') { |file| file.write("\n// Unrelated local work\n") }
  before = File.binread(modified)
  _, _, status = Open3.capture3(RbConfig.ruby, installer, project_directory)
  check(!status.success? && File.binread(modified) == before, 'local edits cause a closed failure')
  check(File.binread(File.join(project_directory, tracked.first)) == first[tracked.first],
        'failed preflight leaves Xcode project unchanged')

  unexpected = File.join(temporary, 'custom-controller')
  fixture(unexpected, 'ExistingBridgeViewController')
  _, _, status = Open3.capture3(RbConfig.ruby, installer, unexpected)
  check(!status.success? && !File.exist?(File.join(unexpected, 'App/Affirmations')),
        'unrecognized custom controller preserved')
  puts 'PASS: installer integration, idempotence, preservation and conflict checks.'
end
