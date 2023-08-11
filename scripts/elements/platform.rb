# frozen_string_literal: true

class Platform
  DIST = "#{Paths::PLATFORM}/dist"
  NODE_MODULES = "#{Paths::PLATFORM}/node_modules"
  TARGETS = [DIST, NODE_MODULES].freeze

  def initialize(reinstall, rebuild)
    @reinstall = reinstall
    @rebuild = rebuild
    @installed = File.exist?(NODE_MODULES)
    @changes_to_files = ChangeChecker.has_changes?(Paths::PLATFORM, TARGETS)
  end

  attr_reader :changes_to_files

  def self.clean
    TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      end
    end
  end

  def install
    Shell.rm_rf(NODE_MODULES) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::PLATFORM) do
        Reporter.log 'Installing platform libraries'
        Shell.sh 'yarn install'
        Reporter.done(self, 'installing', '')
      end
    else
      Reporter.skipped(self, 'installing', '')
    end
  end

  def build
    Environment.check
    install
    Shell.rm_rf(DIST)
    Reporter.removed(self, DIST, '')
    begin
      Shell.chdir(Paths::PLATFORM) do
        Shell.sh 'yarn run build'
        Reporter.done(self, 'build', '')
      end
    rescue StandardError
      Reporter.failed(self, 'build', '')
      clean
      build
    end
    Shell.rm_rf(NODE_MODULES)
  end

  def self.check(consumer, replace)
    node_modules = "#{consumer}/node_modules"
    platform_dest = "#{node_modules}/platform"
    platform = Platform.new(false, false)
    FileUtils.mkdir_p(node_modules)
    if replace || !File.exist?("#{platform_dest}/dist") || File.symlink?(platform_dest) || platform.changes_to_files
      Shell.rm_rf(platform_dest)
    end
    return if File.exist?(platform_dest)

    Reporter.other('Platform', "#{consumer} doesn't have platform", '')
    platform.build
    Shell.sh "cp -r #{Paths::PLATFORM} #{node_modules}"
    Reporter.done('Platform', "delivery to #{consumer}", '')
  end

  def lint
    install
    Shell.chdir(Paths::PLATFORM) do
      Shell.sh 'yarn run lint'
      Reporter.done(self, 'linting', '')
    end
  end
end
