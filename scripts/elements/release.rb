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
      if ENV.key?('APPLEID') && ENV.key?('APPLEIDPASS') && !ENV.key?('SKIP_NOTARIZE')
        './node_modules/.bin/electron-builder --mac --dir'
      else
        './node_modules/.bin/electron-builder --mac --dir -c.mac.identity=null'
      end
    elsif OS.linux?
      './node_modules/.bin/electron-builder --linux --dir'
    else
      './node_modules/.bin/electron-builder --win --dir'
    end
  end

  def self.set_envvars
    Release.load_from_env
    if ENV.key?('SKIP_NOTARIZE')
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
      return
    end
    if OS.mac?
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'true' if ENV.key?('APPLEID') && ENV.key?('APPLEIDPASS')
    else
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
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
      Release.set_envvars
      duration = Shell.timed_sh(Release.build_cmd, 'invoke electron builder')
      Reporter.done('release', 'built', '', duration)
    end
    Release.snapshot
    Reporter.done('release', "done: #{Paths::RELEASE_BUILD}", '')
  end

  task :compress do
    Compressor.new(Paths::RELEASE_BUILD, release_file_name).compress
  end
end
