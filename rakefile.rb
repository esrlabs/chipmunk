require 'fileutils'
# os detection
module OS
  def self.windows?
    (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM) != nil
  end

  def self.mac?
    (/darwin/ =~ RUBY_PLATFORM) != nil
  end

  def self.unix?
    !OS.windows?
  end

  def self.linux?
    OS.unix? && !OS.mac?
  end

end

CLIENT = "application/client"
CLIENT_DIST = "application/client/dist"
ELECTRON = "application/holder"
ELECTRON_DIST = "application/holder/dist"
TSBINDINGS = "application/apps/rustcore/ts-bindings"
RUSTCORE = "application/apps/rustcore"

TSC = "#{ELECTRON}/node_modules/.bin/tsc"

namespace :install do
  desc 'Install client'
  task :client do
    Dir.chdir(CLIENT) do
      sh 'npm install'
    end
  end

  desc 'Install electron'
  task :electron do
    Dir.chdir(ELECTRON) do
      sh 'npm install'
    end
  end

  desc 'install all'
  task :all => ['install:client', 'install:electron']

end

namespace :build do

  desc 'Build client (dev)'
  task :client_compile_dev do
    Dir.chdir(CLIENT) do
      sh 'npm run build'
    end
  end

  desc 'Build client (prod)'
  task :client_compile do
    Dir.chdir(CLIENT) do
      sh 'npm run prod'
    end
  end

  desc 'Build ts-bindings'
  task :tsbindings do
    Dir.chdir(RUSTCORE) do
      sh 'rake build:all'
    end
  end

  desc 'Build electron'
  task :electron do
    Dir.chdir(ELECTRON) do
      sh 'npm run build'
    end
  end

  desc 'Clean'
  task :clean do
    FileUtils.rm_rf(ELECTRON_DIST) unless !File.exists?(ELECTRON_DIST)
    FileUtils.rm_rf(CLIENT_DIST) unless !File.exists?(CLIENT_DIST)
  end

  desc 'Delivery client'
  task :delivery_client do
    client_dist = "#{CLIENT_DIST}/client"

    Dir.mkdir(ELECTRON_DIST) unless File.exists?(ELECTRON_DIST)
    sh "cp -r #{client_dist} #{ELECTRON_DIST}"
  end

  desc 'Delivery ts-bindings'
  task :delivery_ts_bindings do
    client_dist = "#{CLIENT_DIST}/client"
    if File.exists?("#{ELECTRON}/node_modules/rustcore")
      sh "rm -rf #{ELECTRON}/node_modules/rustcore"
    end
    sh "mkdir #{ELECTRON}/node_modules/rustcore"
    sh "cp -r #{TSBINDINGS}/* #{ELECTRON}/node_modules/rustcore"
    FileUtils.rm_rf("#{ELECTRON}/node_modules/rustcore/native") unless !File.exists?("#{ELECTRON}/node_modules/rustcore/native")

  end

  desc 'Complete build electron'
  task :rustcore => ['build:tsbindings', 'build:delivery_ts_bindings', 'build:electron']

  desc 'Complete build client (dev)'
  task :client_dev => ['build:client_compile_dev', 'build:delivery_client']

  desc 'Complete build client (prod)'
  task :client => ['build:client_compile', 'build:delivery_client']

  desc 'build all'
  task :all => ['build:clean',  'build:rustcore', 'build:client']
end