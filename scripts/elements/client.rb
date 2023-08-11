# frozen_string_literal: true

require './scripts/elements/matcher'
require './scripts/elements/utils'
class Client
  DIST = Paths::CLIENT_DIST.to_s
  NODE_MODULES = "#{Paths::CLIENT}/node_modules"
  TARGETS = [DIST, NODE_MODULES].freeze

  def initialize(reinstall, prod)
    @reinstall = reinstall
    @prod = prod
    @installed = File.exist?(NODE_MODULES)
    @changes_to_files = ChangeChecker.has_changes?(Paths::CLIENT, TARGETS)
  end

  def set_changes_to_files(val)
    @changes_to_files = val
  end

  def install
    Shell.rm_rf(NODE_MODULES) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::CLIENT) do
        Reporter.log 'Installing client libraries'
        Shell.sh 'yarn install'
        Reporter.done(self, 'installing', '')
      end
    else
      Reporter.skipped(self, 'installing', '')
    end
  end

  def self.clean
    TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      end
    end
    Shell.rm_rf(Paths::ELECTRON_CLIENT_DEST)
  end

  def build
    Environment.check
    install
    if @prod
      matcher = Matcher.new(true, true)
      ansi = Ansi.new(true, true)
      utils = Utils.new(true, true)
      client_build_needed = @changes_to_files || matcher.changes_to_files || ansi.changes_to_files || utils.changes_to_files
      matcher.build
      ansi.build
      utils.build
      if client_build_needed
        begin
          Shell.chdir(Paths::CLIENT) do
            Shell.sh 'yarn run prod'
            Reporter.done(self, 'build in production mode', '')
          end
        rescue StandardError
          Reporter.failed(self, 'build in production mode', '')
          @changes_to_files = true
          clean
          build
        end
      else
        Reporter.skipped(self, 'build in production mode', '')
      end
    else
      matcher = Matcher.new(false, false)
      ansi = Ansi.new(false, false)
      utils = Utils.new(false, false)
      client_build_needed = @changes_to_files || matcher.changes_to_files || ansi.changes_to_files || utils.changes_to_files
      matcher.build
      ansi.build
      utils.build
      if client_build_needed
        begin
          Shell.chdir(Paths::CLIENT) do
            Shell.sh 'yarn run build'
            Reporter.done(self, 'build in developing mode', '')
          end
        rescue StandardError
          Reporter.failed(self, 'build in developing mode', '')
          @changes_to_files = true
          clean
          build
        end
      else
        Reporter.skipped(self, 'build in developing mode', '')
      end
    end
  end

  def self.delivery(dest, prod, replace)
    path_to_client = "#{Paths::CLIENT_DIST}/#{prod ? 'release' : 'debug'}"
    if !replace && File.exist?(path_to_client)
      Reporter.skipped('Client', 'client already exist', '')
      return
    end
    FileUtils.mkdir_p(dest)
    client = Client.new(false, prod)
    client.build
    FileUtils.cp_r path_to_client, dest
    Reporter.done('Client', "delivery to #{dest}", '')
  end

  def lint
    install
    Shell.chdir(Paths::CLIENT) do
      Shell.sh 'yarn run lint'
      Reporter.done(self, 'linting', '')
    end
  end
end
