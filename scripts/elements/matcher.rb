class Matcher
  def initialize(reinstall, rebuild)
    @pkg = "#{Paths::MATCHER}/pkg"
    @target = "#{Paths::MATCHER}/target"
    @node_modules = "#{Paths::MATCHER}/node_modules"
    @test_output = "#{Paths::MATCHER}/test_output"
    @reinstall = reinstall
    @rebuild = rebuild
    @installed = File.exist?("#{Paths::MATCHER}/node_modules")
  end

  def clean
    if File.exist?(@pkg)
      Shell.rm_rf(@pkg)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@pkg}", '')
    end
    if File.exist?(@target)
      Shell.rm_rf(@target)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@target}", '')
    end
    if File.exist?(@node_modules)
      Shell.rm_rf(@node_modules)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@node_modules}", '')
    end
    if File.exist?(@test_output)
      Shell.rm_rf(@test_output)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@test_output}", '')
    end
  end

  def install
    Shell.rm_rf(@node_modules) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::MATCHER) do
        Shell.sh 'yarn install'
        Reporter.add(Jobs::Install, Owner::Matcher, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Matcher, 'installing', '')
    end
  end

  def build
    if File.exist?(@pkg) && File.exist?(@target) && !@rebuild
      Reporter.add(Jobs::Skipped, Owner::Matcher, 'already built', '')
    else
      Environment.check
      Shell.rm_rf(@pkg)
      Reporter.add(Jobs::Clearing, Owner::Matcher, @pkg, '')
      Shell.rm_rf(@target)
      Reporter.add(Jobs::Clearing, Owner::Matcher, @target, '')
      Shell.chdir(Paths::MATCHER) do
        Shell.sh 'wasm-pack build --target bundler'
      end
      Reporter.add(Jobs::Building, Owner::Matcher, @target, '')
    end
  end
end
