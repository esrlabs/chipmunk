class Platform
  def initialize(reinstall, rebuild)
    @dist = "#{Paths::PLATFORM}/dist"
    @node_modules = "#{Paths::PLATFORM}/node_modules"
    @reinstall = reinstall
    @rebuild = rebuild
    @installed = File.exist?("#{Paths::PLATFORM}/node_modules")
  end

  def clean
    if File.exist?(@dist)
      FileUtils.rm_rf(@dist)
      Reporter.add(Jobs::Clearing, Owner::Platform, "removed: #{@dist}", '')
    end
    if File.exist?(@node_modules)
      FileUtils.rm_rf(@node_modules)
      Reporter.add(Jobs::Clearing, Owner::Platform, "removed: #{@node_modules}", '')
    end
  end

  def install
    FileUtils.rm_rf(@node_modules) if @reinstall && File.exist?(@node_modules)
    if !@installed || @reinstall
      Dir.chdir(Paths::PLATFORM) do
        Rake.sh 'npm install'
        Reporter.add(Jobs::Install, Owner::Platform, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Platform, 'installing', '')
    end
  end

  def build
    Reporter.add(Jobs::Skipped, Owner::Platform, 'already built', '') if File.exist?(@dist) && !@rebuild
    install
    FileUtils.rm_rf(@dist)
    Reporter.add(Jobs::Clearing, Owner::Platform, @dist, '')
    Dir.chdir(Paths::PLATFORM) do
      Rake.sh 'npm run build'
      Reporter.add(Jobs::Building, Owner::Platform, 'clearing', '')
    end
    FileUtils.rm_rf(@node_modules)
  end

  def self.check(consumer, replace)
    node_modules = "#{consumer}/node_modules"
    platform_dest = "#{node_modules}/platform"
    Dir.mkdir(node_modules) unless File.exist?(node_modules)
    if (replace && File.exist?(platform_dest)) || File.symlink?(platform_dest)
      FileUtils.rm_rf(platform_dest)
    end
    unless File.exist?(platform_dest)
      Reporter.add(Jobs::Checks, Owner::Platform, "#{consumer} doesn't have platform", '')
      platform = Platform.new(false, false)
      platform.build
      Rake.sh "cp -r #{Paths::PLATFORM} #{node_modules}"
      Reporter.add(Jobs::Other, Owner::Platform, "delivery to #{consumer}", '')
    end
  end

  def lint
    install
    Dir.chdir(Paths::PLATFORM) do
      Rake.sh 'npm run lint'
      Reporter.add(Jobs::Checks, Owner::Platform, 'linting', '')
    end
  end
end
