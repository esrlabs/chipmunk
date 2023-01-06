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
  end

  def install
    Shell.rm_rf(@node_modules) if @settings.reinstall
    if !@installed || @settings.reinstall
      Shell.chdir(Paths::ELECTRON) do
        Shell.sh 'yarn install'
        Reporter.add(Jobs::Install, Owner::Holder, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Holder, 'installing', '')
    end
  end

  def clean
    if File.exist?(@dist)
      Shell.rm_rf(@dist)
      Reporter.add(Jobs::Clearing, Owner::Holder, "removed: #{@dist}", '')
    end
    if File.exist?(@release)
      Shell.rm_rf(@release)
      Reporter.add(Jobs::Clearing, Owner::Holder, "removed: #{@release}", '')
    end
    if File.exist?(@node_modules)
      Shell.rm_rf(@node_modules)
      Reporter.add(Jobs::Clearing, Owner::Holder, "removed: #{@node_modules}", '')
    end
  end

  def build
    Environment.check
    install
    Platform.check(Paths::ELECTRON, @settings.platform_rebuild)
    Platform.check(Paths::TS_BINDINGS, @settings.platform_rebuild) if @settings.platform_rebuild
    Bindings.check(Paths::ELECTRON, @settings.bindings_reinstall, @settings.bindings_rebuild)
    Client.delivery(@dist, @settings.client_prod, @settings.replace_client)
    Shell.chdir(Paths::ELECTRON) do
      Shell.sh 'yarn run build'
      Reporter.add(Jobs::Building, Owner::Holder, 'built', '')
    end
    Shell.sh "cp #{Paths::ELECTRON}/package.json #{@dist}/package.json"
    Updater.new.check(@settings.launchers_rebuild)
  end

  def lint
    install
    Shell.chdir(Paths::ELECTRON) do
      Shell.sh 'yarn run lint'
      Reporter.add(Jobs::Checks, Owner::Holder, 'linting', '')
    end
  end
end
