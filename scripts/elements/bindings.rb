class Bindings
  def initialize(reinstall)
    @dist = "#{Paths::TS_BINDINGS}/dist"
    @dist_rs = "#{Paths::RS_BINDINGS}/dist"
    @target = "#{Paths::RS_BINDINGS}/target"
    @node_modules = "#{Paths::TS_BINDINGS}/node_modules"
    @build_env = '../ts-bindings/node_modules/.bin/electron-build-env'
    @nj_cli = 'nj-cli'
    @reinstall = reinstall
    @installed = File.exist?(@node_modules)
  end

  def clean
    if File.exist?(@dist)
      FileUtils.remove_dir(@dist, true)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@dist}", '')
    end
    if File.exist?(@node_modules)
      FileUtils.remove_dir(@node_modules, true)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@node_modules}", '')
    end
    if File.exist?(@target)
      FileUtils.remove_dir(@target, true)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@target}", '')
    end
    if File.exist?(@dist_rs)
      FileUtils.remove_dir(@dist_rs, true)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@dist_rs}", '')
    end
  end

  def install
    FileUtils.remove_dir(@node_modules, true) if @reinstall && File.exist?(@node_modules)
    if !@installed || @reinstall
      Dir.chdir(Paths::TS_BINDINGS) do
        Rake.sh 'npm install'
        Reporter.add(Jobs::Install, Owner::Bindings, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Bindings, 'installing', '')
    end
  end

  def build
    Environment.check
    install
    Platform.check(Paths::TS_BINDINGS, false)
    Dir.chdir(Paths::RS_BINDINGS) do
      Rake.sh 'cargo build --release'
      Rake.sh "./#{@build_env} #{@nj_cli} build --release"
      Reporter.add(Jobs::Building, Owner::Bindings, 'rs bindings', '')
    end
    Dir.chdir(Paths::TS_BINDINGS) do
      Rake.sh 'npm run build'
      Reporter.add(Jobs::Building, Owner::Bindings, 'ts bindings', '')
    end
    Rake.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{@dist}/native/index.node"
    dir_tests = "#{Paths::TS_BINDINGS}/src/native"
    mod_file = "#{dir_tests}/index.node"
    FileUtils.rm(mod_file) if File.exist?(mod_file)
    Rake.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{Paths::TS_BINDINGS}/src/native/index.node"
    Reporter.add(Jobs::Other, Owner::Bindings, 'delivery', '')
  end

  def self.check(consumer, reinstall, replace)
    node_modules = "#{consumer}/node_modules"
    rustcore_dest = "#{node_modules}/rustcore"
    Dir.mkdir(node_modules) unless File.exist?(node_modules)
    if (replace && File.exist?(rustcore_dest)) || File.symlink?(rustcore_dest)
      FileUtils.remove_dir(rustcore_dest,
                           true)
    end
    unless File.exist?(rustcore_dest)
      Reporter.add(Jobs::Checks, Owner::Bindings, "#{consumer} doesn't have platform", '')
      bindings = Bindings.new(reinstall)
      bindings.build
      Rake.sh "rm -rf #{node_modules}/rustcore" if File.exist?("#{node_modules}/rustcore")
      Dir.mkdir("#{node_modules}/rustcore")
      Rake.sh "cp -r #{Paths::TS_BINDINGS}/* #{node_modules}/rustcore"
      FileUtils.remove_dir("#{node_modules}/rustcore/native", true) if File.exist?("#{node_modules}/rustcore/native")
      FileUtils.remove_dir("#{node_modules}/rustcore/node_modules", true)
      dest_module = "#{node_modules}/rustcore"
      Dir.chdir(dest_module) do
        Rake.sh 'npm install --production'
      end
      Platform.check(dest_module, false)
      Reporter.add(Jobs::Building, Owner::Bindings, 'reinstalled in production', '')
      Reporter.add(Jobs::Other, Owner::Bindings, "delivery to #{consumer}", '')
    end
  end

  def lint
    install
    Dir.chdir(Paths::TS_BINDINGS) do
      Rake.sh 'npm run lint'
      Reporter.add(Jobs::Checks, Owner::Bindings, 'linting', '')
    end
  end
end
