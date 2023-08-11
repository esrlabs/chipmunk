class Matcher
  def initialize(reinstall, rebuild)
    @pkg = "#{Paths::MATCHER}/pkg"
    @target = "#{Paths::MATCHER}/target"
    @node_modules = "#{Paths::MATCHER}/node_modules"
    @test_output = "#{Paths::MATCHER}/test_output"
    @reinstall = reinstall
    @rebuild = rebuild
    @installed = File.exist?("#{Paths::MATCHER}/node_modules")
    @targets = [@pkg, @target, @node_modules, @test_output]
  end

  def clean
    @targets.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{path}", '')
      else
        Reporter.add(Jobs::Clearing, Owner::Matcher, "doesn't exist: #{path}", '')
      end
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
