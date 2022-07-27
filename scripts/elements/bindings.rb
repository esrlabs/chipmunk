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
      Shell.rm_rf(@dist)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@dist}", '')
    end
    if File.exist?(@node_modules)
      Shell.rm_rf(@node_modules)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@node_modules}", '')
    end
    if File.exist?(@target)
      Shell.rm_rf(@target)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@target}", '')
    end
    if File.exist?(@dist_rs)
      Shell.rm_rf(@dist_rs)
      Reporter.add(Jobs::Clearing, Owner::Bindings, "removed: #{@dist_rs}", '')
    end
  end

  def install
    Shell.rm_rf(@node_modules) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::TS_BINDINGS) do
        Shell.sh 'npm install'
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
    Shell.chdir(Paths::RS_BINDINGS) do
      Shell.sh 'cargo build --release'
      Shell.sh "./#{@build_env} #{@nj_cli} build --release"
      Reporter.add(Jobs::Building, Owner::Bindings, 'rs bindings', '')
    end
    Shell.chdir(Paths::TS_BINDINGS) do
      Shell.sh 'npm run build'
      Reporter.add(Jobs::Building, Owner::Bindings, 'ts bindings', '')
    end
    Shell.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{@dist}/native/index.node"
    dir_tests = "#{Paths::TS_BINDINGS}/src/native"
    mod_file = "#{dir_tests}/index.node"
    Shell.rm(mod_file)
    Shell.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{Paths::TS_BINDINGS}/src/native/index.node"
    Reporter.add(Jobs::Other, Owner::Bindings, 'delivery', '')
  end

  def self.check(consumer, reinstall, replace)
    node_modules = "#{consumer}/node_modules"
    rustcore_dest = "#{node_modules}/rustcore"
    Dir.mkdir(node_modules) unless File.exist?(node_modules)
    if (replace && File.exist?(rustcore_dest)) || File.symlink?(rustcore_dest)
      Shell.rm_rf(rustcore_dest)
    end
    unless File.exist?(rustcore_dest)
      Reporter.add(Jobs::Checks, Owner::Bindings, "#{consumer} doesn't have platform", '')
      bindings = Bindings.new(reinstall)
      bindings.build
      Shell.sh "rm -rf #{node_modules}/rustcore" if File.exist?("#{node_modules}/rustcore")
      Dir.mkdir("#{node_modules}/rustcore")
      Shell.sh "cp -r #{Paths::TS_BINDINGS}/* #{node_modules}/rustcore"
      Shell.rm_rf("#{node_modules}/rustcore/native")
      Shell.rm_rf("#{node_modules}/rustcore/node_modules")
      dest_module = "#{node_modules}/rustcore"
      Shell.chdir(dest_module) do
        Shell.sh 'npm install --production'
      end
      Platform.check(dest_module, false)
      Reporter.add(Jobs::Building, Owner::Bindings, 'reinstalled in production', '')
      Reporter.add(Jobs::Other, Owner::Bindings, "delivery to #{consumer}", '')
    end
  end

  def lint
    install
    Shell.chdir(Paths::TS_BINDINGS) do
      Shell.sh 'npm run lint'
      Reporter.add(Jobs::Checks, Owner::Bindings, 'linting', '')
    end
  end
end
