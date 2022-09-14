class Ansi
  def initialize(reinstall, rebuild)
    @pkg = "#{Paths::ANSI}/pkg"
    @target = "#{Paths::ANSI}/target"
    @node_modules = "#{Paths::ANSI}/node_modules"
    @test_output = "#{Paths::ANSI}/test_output"
    @reinstall = reinstall
    @rebuild = rebuild
    @installed = File.exist?("#{Paths::ANSI}/node_modules")
  end

  def clean
    if File.exist?(@pkg)
      Shell.rm_rf(@pkg)
      Reporter.add(Jobs::Clearing, Owner::Ansi, "removed: #{@pkg}", '')
    end
    if File.exist?(@target)
      Shell.rm_rf(@target)
      Reporter.add(Jobs::Clearing, Owner::Ansi, "removed: #{@target}", '')
    end
    if File.exist?(@node_modules)
      Shell.rm_rf(@node_modules)
      Reporter.add(Jobs::Clearing, Owner::Ansi, "removed: #{@node_modules}", '')
    end
    if File.exist?(@test_output)
      Shell.rm_rf(@test_output)
      Reporter.add(Jobs::Clearing, Owner::Ansi, "removed: #{@test_output}", '')
    end
  end

  def install
    Shell.rm_rf(@node_modules) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::ANSI) do
        Shell.sh 'yarn install'
        Reporter.add(Jobs::Install, Owner::Ansi, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Ansi, 'installing', '')
    end
  end

  def build
    if File.exist?(@pkg) && File.exist?(@target) && !@rebuild
      Reporter.add(Jobs::Skipped, Owner::Ansi, 'already built', '')
    else
      Environment.check
      Shell.rm_rf(@pkg)
      Reporter.add(Jobs::Clearing, Owner::Ansi, @pkg, '')
      Shell.rm_rf(@target)
      Reporter.add(Jobs::Clearing, Owner::Ansi, @target, '')
      Shell.chdir(Paths::ANSI) do
        Shell.sh 'wasm-pack build --target bundler'
      end
      Reporter.add(Jobs::Building, Owner::Ansi, @target, '')
    end
  end
end
