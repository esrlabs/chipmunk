class Client
  def initialize(reinstall, prod)
    @dist = "#{Paths::CLIENT}/dist"
    @node_modules = "#{Paths::CLIENT}/node_modules"
    @reinstall = reinstall
    @prod = prod
    @installed = File.exist?(@node_modules)
    @targets = [@dist, @node_modules]
  end

  def install
    Shell.rm_rf(@node_modules) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::CLIENT) do
        Shell.sh 'yarn install'
        Reporter.add(Jobs::Install, Owner::Client, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Client, 'installing', '')
    end
  end

  def clean
    @targets.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.add(Jobs::Clearing, Owner::Client, "removed: #{path}", '')
      else
        Reporter.add(Jobs::Clearing, Owner::Client, "doesn't exist: #{path}", '')
      end
    end
  end

  def build
    Environment.check
    install
    if @prod
      Matcher.new(true, true).build
      Ansi.new(true, true).build
      Utils.new(true, true).build
      Shell.chdir(Paths::CLIENT) do
        Shell.sh 'yarn run prod'
        Reporter.add(Jobs::Building, Owner::Client, 'production mode', '')
      end
    else
      Matcher.new(false, false).build
      Ansi.new(false, false).build
      Utils.new(false, false).build
      Shell.chdir(Paths::CLIENT) do
        Shell.sh 'yarn run build'
        Reporter.add(Jobs::Building, Owner::Client, 'developing mode', '')
      end
    end
  end

  def self.delivery(dest, prod, replace)
    if !replace && File.exist?("#{Paths::CLIENT}/dist/client")
      Reporter.add(Jobs::Skipped, Owner::Client, 'client already exist', '')
      return
    end
    Dir.mkdir(dest) unless File.exist?(dest)
    client = Client.new(false, prod)
    client.build
    Shell.sh "cp -r #{Paths::CLIENT}/dist/client #{dest}"
    Reporter.add(Jobs::Other, Owner::Client, "delivery to #{dest}", '')
  end

  def lint
    install
    Shell.chdir(Paths::CLIENT) do
      Shell.sh 'yarn run lint'
      Reporter.add(Jobs::Checks, Owner::Client, 'linting', '')
    end
  end
end