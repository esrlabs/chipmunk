class Platform
  def initialize(reinstall, rebuild)
    @dist = "#{Paths::PLATFORM}/dist"
    @node_modules = "#{Paths::PLATFORM}/node_modules"
    @reinstall = reinstall
    @rebuild = rebuild
    @installed = File.exist?("#{Paths::PLATFORM}/node_modules")
    @targets = [@dist, @node_modules]
  end

  def clean
    @targets.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.add(Jobs::Clearing, Owner::Platform, "removed: #{path}", '')
      else
        Reporter.add(Jobs::Clearing, Owner::Platform, "doesn't exist: #{path}", '')
      end
    end
  end

  def install
    Shell.rm_rf(@node_modules) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::PLATFORM) do
        Shell.sh 'yarn install'
        Reporter.add(Jobs::Install, Owner::Platform, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Platform, 'installing', '')
    end
  end

  def build
    Environment.check
    Reporter.add(Jobs::Skipped, Owner::Platform, 'already built', '') if File.exist?(@dist) && !@rebuild
    install
    Shell.rm_rf(@dist)
    Reporter.add(Jobs::Clearing, Owner::Platform, @dist, '')
    Shell.chdir(Paths::PLATFORM) do
      Shell.sh 'yarn run build'
      Reporter.add(Jobs::Building, Owner::Platform, 'clearing', '')
    end
    Shell.rm_rf(@node_modules)
  end

  def self.check(consumer, replace)
    node_modules = "#{consumer}/node_modules"
    platform_dest = "#{node_modules}/platform"
    Dir.mkdir(node_modules) unless File.exist?(node_modules)
    Shell.rm_rf(platform_dest) if replace || !File.exist?("#{platform_dest}/dist") || File.symlink?(platform_dest)
    unless File.exist?(platform_dest)
      Reporter.add(Jobs::Checks, Owner::Platform, "#{consumer} doesn't have platform", '')
      platform = Platform.new(false, false)
      platform.build
      Shell.sh "cp -r #{Paths::PLATFORM} #{node_modules}"
      Reporter.add(Jobs::Other, Owner::Platform, "delivery to #{consumer}", '')
    end
  end

  def lint
    install
    Shell.chdir(Paths::PLATFORM) do
      Shell.sh 'yarn run lint'
      Reporter.add(Jobs::Checks, Owner::Platform, 'linting', '')
    end
  end
end
