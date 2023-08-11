class Platform
  def initialize(reinstall, rebuild)
    @dist = "#{Paths::PLATFORM}/dist"
    @node_modules = "#{Paths::PLATFORM}/node_modules"
    @reinstall = reinstall
    @rebuild = rebuild
    @installed = File.exist?("#{Paths::PLATFORM}/node_modules")
    @targets = [@dist, @node_modules]
    @changes_to_files = ChangeChecker.has_changes?(Paths::PLATFORM, @targets)
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
      Shell.chdir(Paths::PLATFORM) do
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
    Shell.rm_rf(@dist)
    Reporter.removed(self, @dist, '')
    Shell.chdir(Paths::PLATFORM) do
      Shell.sh 'yarn run build'
      Reporter.done(self, 'built', '')
    end
    Shell.rm_rf(@node_modules)
  end

  def self.check(consumer, replace)
    node_modules = "#{consumer}/node_modules"
    platform_dest = "#{node_modules}/platform"
    Dir.mkdir(node_modules) unless File.exist?(node_modules)
    Shell.rm_rf(platform_dest) if replace || !File.exist?("#{platform_dest}/dist") || File.symlink?(platform_dest)
    unless File.exist?(platform_dest)
      Reporter.other(self, "#{consumer} doesn't have platform", '')
      platform = Platform.new(false, false)
      platform.build
      Shell.sh "cp -r #{Paths::PLATFORM} #{node_modules}"
      Reporter.done(self, "delivery to #{consumer}", '')
    end
  end

  def lint
    install
    Shell.chdir(Paths::PLATFORM) do
      Shell.sh 'yarn run lint'
      Reporter.done(self, 'linting', '')
    end
  end
end
