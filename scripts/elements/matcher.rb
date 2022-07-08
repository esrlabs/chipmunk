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
      FileUtils.remove_dir(@pkg, true)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@pkg}", '')
    end
    if File.exist?(@target)
      FileUtils.remove_dir(@target, true)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@target}", '')
    end
    if File.exist?(@node_modules)
      FileUtils.remove_dir(@node_modules, true)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@node_modules}")
    end
    if File.exist?(@test_output)
      FileUtils.remove_dir(@test_output, true)
      Reporter.add(Jobs::Clearing, Owner::Matcher, "removed: #{@test_output}")
    end
  end

  def install
    FileUtils.remove_dir(@node_modules, true) if @reinstall && File.exist?(@node_modules)
    if !@installed || @reinstall
      Dir.chdir(Paths::MATCHER) do
        Rake.sh 'npm install'
        Reporter.add(Jobs::Install, Owner::Matcher, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Matcher, 'installing', '')
    end
  end

  def build
    if File.exist?(@pkg) && File.exist?(@target) && !@rebuild
      Reporter.add(Jobs::Skipped, Owner::Matcher, 'already built', '')
    end
    FileUtils.remove_dir(@pkg, true)
    Reporter.add(Jobs::Clearing, Owner::Matcher, @pkg, '')
    FileUtils.remove_dir(@target, true)
    Reporter.add(Jobs::Clearing, Owner::Matcher, @target, '')
    Dir.chdir(Paths::MATCHER) do
      Rake.sh 'wasm-pack build --target bundler'
    end
    Reporter.add(Jobs::Building, Owner::Matcher, @target, '')
  end
end
