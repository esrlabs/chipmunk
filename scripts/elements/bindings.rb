class Bindings
  def initialize(reinstall)
    @dist = "#{Paths::TS_BINDINGS}/dist"
    @dist_rs = "#{Paths::RS_BINDINGS}/dist"
    @target = "#{Paths::RS_BINDINGS}/target"
    @spec = "#{Paths::TS_BINDINGS}/spec/build"
    @node_modules = "#{Paths::TS_BINDINGS}/node_modules"
    @build_env = '../ts-bindings/node_modules/.bin/electron-build-env'
    @nj_cli = 'nj-cli'
    @reinstall = reinstall
    @installed = File.exist?(@node_modules)
    @targets = [@dist, @node_modules, @target, @dist_rs, @spec]
    @changes_to_rs = ChangeChecker.has_changes?(Paths::RS_BINDINGS, [@dist_rs, @target])
    @changes_to_ts = ChangeChecker.has_changes?(Paths::TS_BINDINGS, [@dist, @spec, @node_modules])
  end

  def clean
    @targets.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      else
        Reporter.other(self, "doesn't exist: #{path}", '')
      end
    end
  end

  def install
    Shell.rm_rf(@node_modules) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::TS_BINDINGS) do
        Shell.sh 'yarn install'
        Reporter.done(self, 'installing', '')
      end
    else
      Reporter.skipped(self, 'installing', '')
    end
  end

  def build
    Environment.check
    install
    Platform.check(Paths::TS_BINDINGS, false)
    if @changes_to_rs || @changes_to_ts
      Shell.chdir(Paths::RS_BINDINGS) do
        Shell.sh "./#{@build_env} #{@nj_cli} build --release"
        Reporter.done(self, 'build rs bindings', '')
      end
      Shell.chdir(Paths::TS_BINDINGS) do
        Shell.sh 'yarn run build'
        Reporter.done(self, 'build ts bindings', '')
      end
      Shell.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{@dist}/native/index.node"
      dir_tests = "#{Paths::TS_BINDINGS}/src/native"
      mod_file = "#{dir_tests}/index.node"
      Shell.rm(mod_file)
      Shell.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{Paths::TS_BINDINGS}/src/native/index.node"
      Reporter.done(self, 'delivery', '')
    end
  end

  def build_spec
    Shell.chdir("#{Paths::TS_BINDINGS}/spec") do
      Shell.sh '../node_modules/.bin/tsc -p tsconfig.json' unless File.exist?('./build')
    end
  end

  def self.check(consumer, reinstall, replace)
    node_modules = "#{consumer}/node_modules"
    rustcore_dest = "#{node_modules}/rustcore"
    Dir.mkdir(node_modules) unless File.exist?(node_modules)
    Shell.rm_rf(rustcore_dest) if replace || !File.exist?("#{rustcore_dest}/dist") || File.symlink?(rustcore_dest)
    unless File.exist?(rustcore_dest)
      Reporter.other(self, "#{consumer} doesn't have platform", '')
      bindings = Bindings.new(reinstall)
      bindings.build
      Shell.sh "rm -rf #{node_modules}/rustcore" if File.exist?("#{node_modules}/rustcore")
      Dir.mkdir("#{node_modules}/rustcore")
      Shell.sh "cp -r #{Paths::TS_BINDINGS}/* #{node_modules}/rustcore"
      Shell.rm_rf("#{node_modules}/rustcore/native")
      Shell.rm_rf("#{node_modules}/rustcore/node_modules")
      dest_module = "#{node_modules}/rustcore"
      Shell.chdir(dest_module) do
        Shell.sh 'yarn install --production'
      end
      Platform.check(dest_module, false)
      Reporter.done(self, 'reinstalled in production', '')
      Reporter.done(self, "delivery to #{consumer}", '')
    end
  end

  def lint
    install
    Shell.chdir(Paths::TS_BINDINGS) do
      Shell.sh 'yarn run lint'
      Reporter.done(self, 'linting', '')
    end
  end
end
