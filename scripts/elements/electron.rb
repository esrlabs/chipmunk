# frozen_string_literal: true

require './scripts/elements/indexer'
class HolderSettings
  attr_accessor :reinstall, :replace_client, :client_prod, :platform_rebuild, :bindings_rebuild, :bindings_reinstall,
                :launchers_rebuild

  def initialize
    self.reinstall = false
    self.client_prod = false
    self.replace_client = true
    self.platform_rebuild = false
    self.bindings_rebuild = false
    self.bindings_reinstall = false
    self.launchers_rebuild = false
  end

  def set_reinstall(val)
    self.reinstall = val
    self
  end

  def set_replace_client(val)
    self.replace_client = val
    self
  end

  def set_client_prod(val)
    self.client_prod = val
    self
  end

  def set_platform_rebuild(val)
    self.platform_rebuild = val
    self
  end

  def set_bindings_rebuild(val)
    self.bindings_rebuild = val
    self
  end

  def set_bindings_reinstall(val)
    self.bindings_reinstall = val
    self
  end

  def set_launchers_rebuild(val)
    self.launchers_rebuild = val
    self
  end
end

class Holder
  def initialize(settings)
    @dist = "#{Paths::ELECTRON}/dist"
    @release = "#{Paths::ELECTRON}/release"
    @node_modules = "#{Paths::ELECTRON}/node_modules"
    @settings = settings
    @installed = File.exist?(@node_modules)
    @targets = [@dist, @release, @node_modules]
    @changes_to_holder = ChangeChecker.has_changes?(Paths::ELECTRON, @targets)
  end

  def install
    Shell.rm_rf(@node_modules) if @settings.reinstall
    if !@installed || @settings.reinstall
      Shell.chdir(Paths::ELECTRON) do
        Shell.sh 'yarn install'
        Reporter.done(self, 'installing', '')
      end
    else
      Reporter.skipped(self, 'installing', '')
    end
  end

  def clean
    (@targets + Indexer.new.targets).each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      else
        Reporter.other(self, "doesn't exist: #{path}", '')
      end
    end
  end

  def build
    Environment.check
    install
    Platform.check(Paths::ELECTRON, @settings.platform_rebuild)
    Platform.check(Paths::TS_BINDINGS, @settings.platform_rebuild) if @settings.platform_rebuild
    Bindings.check(Paths::ELECTRON, @settings.bindings_reinstall, @settings.bindings_rebuild)
    Client.delivery(@dist, @settings.client_prod, @settings.replace_client)
    if @changes_to_holder || Indexer.new.changes_to_files
      begin
        Shell.chdir(Paths::ELECTRON) do
          Shell.sh 'yarn run build'
          Reporter.done(self, 'built', '')
        end
      rescue StandardError
        Reporter.failed(self, 'build', '')
        @changes_to_holder = true
        clean
        build
      end
      Shell.sh "cp #{Paths::ELECTRON}/package.json #{@dist}/package.json"
      Updater.new.check(@settings.launchers_rebuild)
    else
      Reporter.skipped(self, 'build', '')
    end
  end

  def lint
    install
    Shell.chdir(Paths::ELECTRON) do
      Shell.sh 'yarn run lint'
      Reporter.done(self, 'linting', '')
    end
  end
end