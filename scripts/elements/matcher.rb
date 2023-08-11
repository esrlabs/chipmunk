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
    @changes_to_files = ChangeChecker.has_changes?(Paths::MATCHER, @targets)
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
    if !@changes_to_files && !@rebuild
      Reporter.add(Jobs::Skipped, Owner::Matcher, 'already built', '')
    else
      Environment.check
      [@pkg, @target].each do |path|
        Shell.rm_rf(path)
        Reporter.add(Jobs::Clearing, Owner::Matcher, path, '')
      end
      Shell.chdir(Paths::MATCHER) do
        Shell.sh 'wasm-pack build --target bundler'
      end
      Reporter.add(Jobs::Building, Owner::Matcher, @target, '')
    end
  end
end
