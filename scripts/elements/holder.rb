class Holder
  def initialize(reinstall, client_prod)
    @dist = "#{Paths::ELECTRON}/dist"
    @release = "#{Paths::ELECTRON}/release"
    @node_modules = "#{Paths::ELECTRON}/node_modules"
    @reinstall = reinstall
    @client_prod = client_prod
    @installed = File.exist?(@node_modules)
  end

  def install
    FileUtils.remove_dir(@node_modules, true) if @reinstall && File.exist?(@node_modules)
    if !@installed || @reinstall
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
    Platform.check(Paths::ELECTRON, false)
    Bindings.check(Paths::ELECTRON, false)
    Client.delivery(@dist, @client_prod)
    Dir.chdir(Paths::ELECTRON) do
      Rake.sh 'npm run build'
      Reporter.add(Jobs::Building, Owner::Holder, 'built', '')
    end
  end

  def lint
    install
    Dir.chdir(Paths::ELECTRON) do
      Rake.sh 'npm run lint'
      Reporter.add(Jobs::Checks, Owner::Holder, 'linting', '')
    end
  end

end
namespace :testing do
  desc 'Install client'
  task :once do
    holder = Holder.new(false, true)
    holder.build
    Reporter.print
  end
end
