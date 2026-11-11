#!/usr/bin/env ruby
# Run after `cap add ios --packagemanager CocoaPods` and before the final pod install.
# The generated ios/ tree is disposable; native/affirmations/ios is authoritative.
require 'digest'
require 'fileutils'
require 'json'
require 'rexml/document'
require 'tmpdir'
require 'xcodeproj'

ROOT = File.expand_path('../..', __dir__)
SOURCE = File.join(ROOT, 'native/affirmations/ios')
PROJECT_DIR = File.expand_path(ARGV.fetch(0, File.join(ROOT, 'ios/App')))
APP_GROUP = 'group.dev.purama.mukti.affirmations'
WIDGET_TARGET = 'MuktiAffirmationWidget'
MANIFEST = File.join(PROJECT_DIR, '.mukti-affirmations-install.json')

def check(condition, message)
  raise "Affirmation widget installation stopped: #{message}" unless condition
end

def plist_bytes(value)
  Dir.mktmpdir('mukti-widget-plist') do |directory|
    path = File.join(directory, 'value.plist')
    Xcodeproj::Plist.write_to_path(value, path)
    File.binread(path)
  end
end

def canonical_manifest(value)
  case value
  when Hash
    value.keys.sort.each_with_object({}) do |key, result|
      result[key] = canonical_manifest(value.fetch(key))
    end
  when Array
    # The order of entitlement groups, flags and search paths is meaningful.
    value.map { |item| canonical_manifest(item) }
  else
    value
  end
end

def inside_project(relative)
  path = File.expand_path(relative, PROJECT_DIR)
  check(path.start_with?(PROJECT_DIR + '/'), "path outside generated project: #{relative}")
  path
end

project_path = File.join(PROJECT_DIR, 'App.xcodeproj')
pbx_path = File.join(project_path, 'project.pbxproj')
storyboard_path = File.join(PROJECT_DIR, 'App/Base.lproj/Main.storyboard')
info_path = File.join(PROJECT_DIR, 'App/Info.plist')
[pbx_path, storyboard_path, info_path].each { |path| check(File.file?(path), "missing #{path}") }
original_bytes = [pbx_path, storyboard_path, info_path].to_h { |path| [path, File.binread(path)] }
manifest = File.file?(MANIFEST) ? JSON.parse(File.read(MANIFEST)) : { 'version' => 1, 'files' => {} }
check(manifest['version'] == 1 && manifest['files'].is_a?(Hash), 'unknown installer manifest')
manifest['original_entitlements'] ||= {}

project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == 'App' }
check(app && app.product_type == 'com.apple.product-type.application', 'expected App application target')
app.build_configurations.each do |configuration|
  check(configuration.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] == 'dev.purama.mukti',
        "unexpected app identifier for #{configuration.name}")
end
widget = project.targets.find { |target| target.name == WIDGET_TARGET }
check(!widget || manifest['target_uuid'] == widget.uuid, 'existing widget target is not managed by this installer')
if widget && manifest['target_settings']
  widget.build_configurations.each do |configuration|
    manifest['target_settings'].fetch(configuration.name, {}).each do |key, value|
      check(configuration.build_settings[key] == value,
            "locally modified widget setting preserved: #{configuration.name}/#{key}")
    end
  end
end
embed = app.copy_files_build_phases.find { |phase| phase.name == 'Embed App Extensions' }
check(!embed || embed.dst_subfolder_spec.to_s == '13', 'unexpected Embed App Extensions destination')

# Only the known Capacitor root controller is replaced. Other custom controllers
# are preserved by refusing to guess how to compose their behaviour.
storyboard = REXML::Document.new(original_bytes.fetch(storyboard_path))
controllers = REXML::XPath.match(storyboard, '//viewController').select do |node|
  %w[CAPBridgeViewController AffirmationBridgeViewController].include?(node.attributes['customClass'])
end
check(controllers.length == 1, 'expected exactly one Capacitor bridge controller')
controller = controllers.first
allowed_module = controller.attributes['customClass'] == 'CAPBridgeViewController' ? 'Capacitor' : 'App'
check(controller.attributes['customModule'] == allowed_module, 'unexpected storyboard bridge module')
controller.attributes['customClass'] = 'AffirmationBridgeViewController'
controller.attributes['customModule'] = 'App'
controller.attributes['customModuleProvider'] = 'target'

info = Xcodeproj::Plist.read_from_path(info_path)
url_types = info.fetch('CFBundleURLTypes', [])
check(url_types.is_a?(Array) && url_types.all? { |entry| entry.is_a?(Hash) }, 'invalid URL schemes in Info.plist')
unless url_types.any? { |entry| Array(entry['CFBundleURLSchemes']).include?('mukti') }
  url_types << { 'CFBundleURLName' => 'dev.purama.mukti.affirmations',
                 'CFBundleTypeRole' => 'Viewer', 'CFBundleURLSchemes' => ['mukti'] }
end
info['CFBundleURLTypes'] = url_types

# Preflight every managed output before editing any generated project file.
outputs = {}
shared_sources = Dir[File.join(SOURCE, 'Shared/*.swift')].sort
app_sources = Dir[File.join(SOURCE, 'App/*.swift')].sort
check(shared_sources.length == 3 && app_sources.length == 2, 'missing native source files')
source_paths = {}
(shared_sources + app_sources).each do |path|
  relative = "App/Affirmations/#{path.delete_prefix(SOURCE + '/')}"
  outputs[relative] = File.binread(path)
  source_paths[path] = relative
end
%w[AffirmationWidget.swift Info.plist AffirmationWidget.entitlements].each do |name|
  path = File.join(SOURCE, 'Widget', name)
  check(File.file?(path), "missing widget source #{name}")
  outputs["AffirmationWidget/#{name}"] = File.binread(path)
end
app.build_configurations.each do |configuration|
  check(configuration.name.match?(/\A[A-Za-z0-9_-]+\z/), 'unsupported build configuration name')
  if manifest['target_uuid']
    expected = "App/Affirmations/Entitlements/#{configuration.name}.entitlements"
    check(configuration.build_settings['CODE_SIGN_ENTITLEMENTS'] == expected,
          "locally changed app entitlement path preserved: #{configuration.name}")
  end
  initial = manifest['original_entitlements'].fetch(configuration.name) do
    configuration.build_settings['CODE_SIGN_ENTITLEMENTS']
  end
  manifest['original_entitlements'][configuration.name] = initial
  entitlements = {}
  unless initial.nil? || initial.empty?
    relative = initial.sub(/\A\$\(SRCROOT\)\//, '')
    check(!relative.include?('$'), "unresolved entitlement path: #{initial}")
    original = inside_project(relative)
    check(File.file?(original), "missing original entitlements: #{initial}")
    entitlements = Xcodeproj::Plist.read_from_path(original)
  end
  groups = entitlements.fetch('com.apple.security.application-groups', [])
  check(groups.is_a?(Array), 'invalid existing App Group entitlement')
  entitlements['com.apple.security.application-groups'] = (groups + [APP_GROUP]).uniq
  relative = "App/Affirmations/Entitlements/#{configuration.name}.entitlements"
  outputs[relative] = plist_bytes(entitlements)
  configuration.build_settings['CODE_SIGN_ENTITLEMENTS'] = relative
end
outputs.each do |relative, bytes|
  path = inside_project(relative)
  next unless File.exist?(path)
  check(File.file?(path) && !File.symlink?(path), "managed output is not a regular file: #{relative}")
  old = File.binread(path)
  check(old == bytes || manifest['files'][relative] == Digest::SHA256.hexdigest(old),
        "locally modified output preserved: #{relative}")
end

widget ||= project.new_target(:app_extension, WIDGET_TARGET, :ios, '16.0')
check(widget.product_type == 'com.apple.product-type.app-extension', 'unexpected widget product type')
widget.build_configurations.each do |configuration|
  matching = app.build_configurations.find { |item| item.name == configuration.name } || app.build_configurations.first
  settings = configuration.build_settings
  settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'dev.purama.mukti.affirmations',
    'PRODUCT_NAME' => '$(TARGET_NAME)', 'SWIFT_VERSION' => '5.0',
    'IPHONEOS_DEPLOYMENT_TARGET' => '16.0', 'TARGETED_DEVICE_FAMILY' => '1,2',
    'INFOPLIST_FILE' => 'AffirmationWidget/Info.plist', 'GENERATE_INFOPLIST_FILE' => 'NO',
    'CODE_SIGN_ENTITLEMENTS' => 'AffirmationWidget/AffirmationWidget.entitlements',
    'APPLICATION_EXTENSION_API_ONLY' => 'YES', 'SKIP_INSTALL' => 'YES',
    'CODE_SIGN_STYLE' => matching.build_settings.fetch('CODE_SIGN_STYLE', 'Automatic'),
    'CURRENT_PROJECT_VERSION' => matching.build_settings.fetch('CURRENT_PROJECT_VERSION', '1'),
    'MARKETING_VERSION' => matching.build_settings.fetch('MARKETING_VERSION', '1.0'),
    'LD_RUNPATH_SEARCH_PATHS' => ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  })
  team = matching.build_settings['DEVELOPMENT_TEAM']
  settings['DEVELOPMENT_TEAM'] = team if team && !team.empty?
end

group = project.main_group['MuktiAffirmations'] || project.main_group.new_group('MuktiAffirmations')
add_source = lambda do |relative, targets|
  reference = group.files.find { |file| file.path == relative } || group.new_file(relative)
  targets.each { |target| target.source_build_phase.add_file_reference(reference, true) }
end
shared_sources.each { |path| add_source.call(source_paths.fetch(path), [app, widget]) }
app_sources.each { |path| add_source.call(source_paths.fetch(path), [app]) }
add_source.call('AffirmationWidget/AffirmationWidget.swift', [widget])

# SDKROOT references avoid hard-coding the runner's installed SDK version.
%w[WidgetKit SwiftUI].each do |name|
  path = "System/Library/Frameworks/#{name}.framework"
  reference = project.frameworks_group.files.find { |file| file.path == path }
  reference ||= project.frameworks_group.new_file(path, :sdk_root)
  widget.frameworks_build_phase.add_file_reference(reference, true)
  app.frameworks_build_phase.add_file_reference(reference, true) if name == 'WidgetKit'
end
app.add_dependency(widget)
embed ||= app.new_copy_files_build_phase('Embed App Extensions')
embed.dst_subfolder_spec = '13'
embed.dst_path = ''
build_file = embed.add_file_reference(widget.product_reference, true)
build_file.settings ||= {}
build_file.settings['ATTRIBUTES'] = (Array(build_file.settings['ATTRIBUTES']) + ['RemoveHeadersOnCopy']).uniq
attributes = project.root_object.attributes['TargetAttributes'] ||= {}
[app, widget].each do |target|
  attributes[target.uuid] ||= {}
  capabilities = attributes[target.uuid]['SystemCapabilities'] ||= {}
  capabilities['com.apple.ApplicationGroups.iOS'] = { 'enabled' => 1 }
end

# Refuse concurrent changes to the project inputs, then publish prepared outputs.
original_bytes.each do |path, bytes|
  check(File.binread(path) == bytes, "project changed concurrently: #{path}")
end
outputs.each do |relative, bytes|
  path = inside_project(relative)
  FileUtils.mkdir_p(File.dirname(path))
  File.binwrite(path, bytes) unless File.file?(path) && File.binread(path) == bytes
  manifest['files'][relative] = Digest::SHA256.hexdigest(bytes)
end
File.write(storyboard_path, storyboard.to_s)
File.binwrite(info_path, plist_bytes(info))
project.save
manifest['target_uuid'] = widget.uuid
manifest['target_settings'] = widget.build_configurations.to_h do |configuration|
  [configuration.name, configuration.build_settings.to_h]
end
# Xcodeproj normalizes build-setting key order when reloading the saved project.
# Canonical JSON keeps the first and subsequent installation receipts identical.
manifest_bytes = JSON.pretty_generate(canonical_manifest(manifest)) + "\n"
File.binwrite(MANIFEST, manifest_bytes) unless File.file?(MANIFEST) && File.binread(MANIFEST) == manifest_bytes
puts 'PASS: MUKTI WidgetKit target, native bridge, App Groups and URL scheme installed.'
puts 'Native compilation, signing and device behaviour still require their own checks.'
