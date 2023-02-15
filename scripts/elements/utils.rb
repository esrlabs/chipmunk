class Utils
    def initialize(reinstall, rebuild)
      @pkg = "#{Paths::UTILS}/pkg"
      @target = "#{Paths::UTILS}/target"
      @node_modules = "#{Paths::UTILS}/node_modules"
      @test_output = "#{Paths::UTILS}/test_output"
      @reinstall = reinstall
      @rebuild = rebuild
      @installed = File.exist?("#{Paths::UTILS}/node_modules")
      @targets = [@pkg, @target, @node_modules, @test_output]
    end
  
    def clean
      @targets.each do |path|
        if File.exist?(path)
          Shell.rm_rf(path)
          Reporter.add(Jobs::Clearing, Owner::Utils, "removed: #{path}", '')
        else
          Reporter.add(Jobs::Clearing, Owner::Utils, "doesn't exist: #{path}", '')
        end
      end
    end
  
    def install
      Shell.rm_rf(@node_modules) if @reinstall
      if !@installed || @reinstall
        Shell.chdir(Paths::UTILS) do
          Shell.sh 'yarn install'
          Reporter.add(Jobs::Install, Owner::Utils, 'installing', '')
        end
      else
        Reporter.add(Jobs::Skipped, Owner::Utils, 'installing', '')
      end
    end
  
    def build
      if File.exist?(@pkg) && File.exist?(@target) && !@rebuild
        Reporter.add(Jobs::Skipped, Owner::Utils, 'already built', '')
      else
        Environment.check
        Shell.rm_rf(@pkg)
        Reporter.add(Jobs::Clearing, Owner::Utils, @pkg, '')
        Shell.rm_rf(@target)
        Reporter.add(Jobs::Clearing, Owner::Utils, @target, '')
        Shell.chdir(Paths::UTILS) do
          Shell.sh 'wasm-pack build --target bundler'
        end
        Reporter.add(Jobs::Building, Owner::Utils, @target, '')
      end
    end
  end
  