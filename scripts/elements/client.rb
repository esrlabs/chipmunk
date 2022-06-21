class Client
  def initialize(reinstall, prod)
    @dist = "#{Paths::CLIENT}/dist"
    @node_modules = "#{Paths::CLIENT}/node_modules"
    @reinstall = reinstall
    @prod = prod
    @installed = File.exist?(@node_modules)
  end

  def install
    FileUtils.remove_dir(@node_modules, true) if @reinstall && File.exist?(@node_modules)
    if !@installed || @reinstall
      Dir.chdir(Paths::CLIENT) do
        Rake.sh 'npm install'
        Reporter.add(Jobs::Install, Owner::Client, 'installing', '')
      end
    else
      Reporter.add(Jobs::Skipped, Owner::Client, 'installing', '')
    end
  end

  def clean
    if File.exist?(@dist)
      FileUtils.remove_dir(@dist, true)
      Reporter.add(Jobs::Clearing, Owner::Client, "removed: #{@dist}", '')
    end
    if File.exist?(@node_modules)
      FileUtils.remove_dir(@node_modules, true)
      Reporter.add(Jobs::Clearing, Owner::Client, "removed: #{@node_modules}", '')
    end
  end

  def build
    install
    if @prod
      Dir.chdir(Paths::CLIENT) do
        Rake.sh 'npm run prod'
        Reporter.add(Jobs::Building, Owner::Client, 'production mode', '')
      end
    else
      Dir.chdir(Paths::CLIENT) do
        Rake.sh 'npm run build'
        Reporter.add(Jobs::Building, Owner::Client, 'developing mode', '')
      end
    end
  end

  def self.delivery(dest, prod)
    Dir.mkdir(dest) unless File.exist?(dest)
    client = Client.new(false, prod)
    client.build
    Rake.sh "cp -r #{Paths::CLIENT}/dist/client #{dest}"
    Reporter.add(Jobs::Other, Owner::Client, "delivery to #{dest}", '')
  end

  def lint
    install
    Dir.chdir(Paths::CLIENT) do
      Rake.sh 'npm run lint'
      Reporter.add(Jobs::Checks, Owner::Client, 'linting', '')
    end
  end
end

namespace :client do
  desc 'Install client'
  task :test do
    client = Client.new(false, true)
    client.build
  end

  desc 'Install client'
  task :install do
    Dir.chdir(Paths::CLIENT) do
      sh 'npm install'
    end
  end

  desc 'Build client (dev)'
  task :dev do
    Dir.chdir(Paths::CLIENT) do
      sh 'npm run build'
    end
  end

  desc 'Build client (prod)'
  task :prod do
    Dir.chdir(Paths::CLIENT) do
      sh 'npm run prod'
    end
  end

  desc 'Clean'
  task :clean do
    FileUtils.rm_rf(Paths::CLIENT_DIST) if File.exist?(Paths::CLIENT_DIST)
    FileUtils.rm_rf(Paths::ELECTRON_CLIENT_DEST) if File.exist?(Paths::ELECTRON_CLIENT_DEST)
  end

  desc 'Delivery client'
  task :delivery do
    client_dist = "#{Paths::CLIENT_DIST}/client"
    Dir.mkdir(Paths::ELECTRON_DIST) unless File.exist?(Paths::ELECTRON_DIST)
    sh "cp -r #{client_dist} #{Paths::ELECTRON_DIST}"
  end

  desc 'Install, build and delivery'
  task all: ['client:install', 'client:clean', 'client:prod', 'client:delivery']
end
