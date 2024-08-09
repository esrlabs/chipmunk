# frozen_string_literal: true
require 'json'
require './scripts/tools/compressor'

# Needed to get release meta data
module Release
  def self.load_from_env
    require 'dotenv'
    Dotenv.load
  rescue LoadError
    puts 'dotenv not found, not considering .env file!'
  end

  def self.build_cmd
    Release.load_from_env
    if OS.mac?
      if OS.arm64?
        './node_modules/.bin/electron-builder --mac --dir --config=./electron.config.darwin.arm64.json -c.mac.identity=null'
      else
        './node_modules/.bin/electron-builder --mac --dir --config=./electron.config.darwin.x86.json -c.mac.identity=null'
      end
    elsif OS.linux?
      './node_modules/.bin/electron-builder --linux --dir --config=./electron.config.linux.json'
    else
      './node_modules/.bin/electron-builder --win --dir --config=./electron.config.win.json'
    end
  end

  def self.snapshot
    if OS.mac?
      Reporter.skipped(self, "build for darwin doesn't require snapshot", '')
      return
    end
    snapshot_file = "#{Paths::RELEASE_BIN}/.release"
    FileUtils.rm_f(snapshot_file)
    lines = ".release\n"
    Dir.foreach(Paths::RELEASE_BIN) do |entry|
      lines = "#{lines}#{entry}\n" if entry != '.' && entry != '..'
    end
    File.open(snapshot_file, 'a') do |fd|
      fd.puts lines
      fd.flush
      fd.close
    end
    Reporter.done('release', 'files snapshot has been created', '')
  end

  def self.version
    package = JSON.parse(File.read("#{Paths::ELECTRON}/package.json"))
    package['version']
  end
end

def release_file_name
  prefix = OS.prefix
  prefix += '64' if prefix == 'win'
  prefix += '-arm64' if OS.arm64?
  "chipmunk@#{Release.version}-#{prefix}-portable"
end

namespace :release do
  task :clean do
    if File.exist?(Paths::RELEASE)
      Shell.rm_rf(Paths::RELEASE)
      Reporter.removed('release', "removed: #{File.basename(Paths::RELEASE)}", '')
    end
  end

  task prepare_build: ['environment:check', 'release:clean', 'updater:build']

  desc 'Create release (production mode)'
  task prod: [
    'release:prepare_build',
    'electron:build_prod',
    'release:bundle',
    'release:compress'
  ]

  desc 'Create release (dev mode)'
  task dev: [
    'release:prepare_build',
    'electron:build_dev',
    'release:bundle'
  ]

  task :bundle do
    Shell.chdir(Paths::ELECTRON) do
      Release.load_from_env
      duration = Shell.timed_sh(Release.build_cmd, 'invoke electron builder')
      Reporter.done('release', 'built', '', duration)
    end
    Release.snapshot
    Reporter.done('release', "done: #{Paths::RELEASE_BUILD}", '')
  end

  task :codesign_for_mac do
    Shell.chdir(Paths::ELECTRON) do
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'true'
      options = "--force --timestamp --options runtime --verbose --deep --strict --entitlements ./resources/mac/entitlements.mac.plist"
      app_path = "#{Paths::RELEASE_BUILD}/chipmunk.app"

      # Array of paths to sign
      paths_to_sign = []
      paths_to_sign << "#{app_path}/Contents/Resources/bin/updater" # add updater
      paths_to_sign << "#{app_path}/Contents/MacOS/chipmunk" # add executable
      paths_to_sign += Dir.glob("#{app_path}/Contents/Frameworks/*.framework/Versions/A/**/**").select { |path| File.file?(path) && !File.symlink?(path)} # add all frameworks
      paths_to_sign << app_path # add main app

      # Sign each path
      paths_to_sign.each do |path|
        command = "codesign --sign \"#{ENV['SIGNING_ID']}\" #{options} \"#{path}\""
        Shell.sh "#{command}"
      end

      Shell.sh "codesign -vvv --deep --strict \"#{app_path}\""
    end
  end

  task :compress do
    if OS.mac?
      if ENV.key?('APPLEID') && ENV.key?('APPLEIDPASS') && !ENV.key?('SKIP_NOTARIZE')
        Rake::Task["release:codesign_for_mac"].invoke
      end
    end
    Compressor.new(Paths::RELEASE_BUILD, release_file_name).compress
    if OS.mac?
      if ENV.key?('APPLEID') && ENV.key?('APPLEIDPASS') && !ENV.key?('SKIP_NOTARIZE')
        Rake::Task["release:notarize_for_mac"].invoke
      end
    end
  end

  task :notarize_for_mac do
    Shell.chdir(Paths::ELECTRON) do
      # Run the notarytool submit command
      Shell.sh("xcrun notarytool submit --force --wait --verbose \"#{Paths::RELEASE}/#{release_file_name}.tgz\" --apple-id \"$APPLEID\" --team-id \"$TEAMID\" --password \"$APPLEIDPASS\"")
    end
  end
end
