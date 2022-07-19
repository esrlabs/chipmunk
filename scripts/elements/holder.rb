class HolderSettings
  attr_accessor :reinstall, :client_prod, :platform_rebuild, :bindings_rebuild, :bindings_reinstall, :launchers_rebuild

  def initialize
    self.reinstall = false
    self.client_prod = false
    self.platform_rebuild = false
    self.bindings_rebuild = false
    self.bindings_reinstall = false
    self.launchers_rebuild = false
  end

  def set_reinstall(val)
    self.reinstall = val
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
    FileUtils.remove_dir(@node_modules, true) if @settings.reinstall && File.exist?(@node_modules)
    if !@installed || @settings.reinstall
      Dir.chdir(Paths::ELECTRON) do
        Rake.sh 'npm install'
        Reporter.add(Jobs::Install, Owner::Holder, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Holder, 'installing', '')
    end
  end

  def clean
    if File.exist?(@dist)
      FileUtils.remove_dir(@dist, true)
      Reporter.add(Jobs::Clearing, Owner::Holder, "removed: #{@dist}", '')
    end
    if File.exist?(@release)
      FileUtils.remove_dir(@release, true)
      Reporter.add(Jobs::Clearing, Owner::Holder, "removed: #{@release}", '')
    end
    if File.exist?(@node_modules)
      FileUtils.remove_dir(@node_modules, true)
      Reporter.add(Jobs::Clearing, Owner::Holder, "removed: #{@node_modules}", '')
    end
  end

  def build
    install
    Platform.check(Paths::ELECTRON, @settings.platform_rebuild)
    Bindings.check(Paths::ELECTRON, @settings.bindings_reinstall, @settings.bindings_rebuild)
    Client.delivery(@dist, @settings.client_prod)
    Dir.chdir(Paths::ELECTRON) do
      Rake.sh 'npm run build'
      Reporter.add(Jobs::Building, Owner::Holder, 'built', '')
    end
    Rake.sh "cp #{Paths::ELECTRON}/package.json #{@dist}/package.json"
    Launchers.new.check(@settings.launchers_rebuild)
  end

  def lint
    install
    Dir.chdir(Paths::ELECTRON) do
      Rake.sh 'npm run lint'
      Reporter.add(Jobs::Checks, Owner::Holder, 'linting', '')
    end
  end
end
