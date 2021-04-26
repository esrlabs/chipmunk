require 'fileutils'

TS = "./ts-bindings"
TS_BUILD = "./ts-bindings/dist/apps/rustcore/ts-bindings"
TS_CLI = "./ts-bindings-cli"
RS = "./rs-bindings"
BUILD_ENV = "#{TS}/node_modules/.bin/electron-build-env"
TSC = "#{TS}/node_modules/.bin/tsc"
TSC_CLI = "#{TS_CLI}/node_modules/.bin/tsc"
NJ_CLI = 'nj-cli'
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

namespace :install do
  desc 'Install TS'
  task :ts do
    Dir.chdir(TS) do
      sh 'npm install'
    end
  end

  desc 'Install TS-CLI'
  task :ts_cli do
    Dir.chdir(TS_CLI) do
      sh 'npm install'
    end
  end

  desc 'install all'
  task :all => ['install:ts', 'install:ts_cli']

end

namespace :build do

  desc 'Build TS'
  task :ts do
    sh "#{TSC} -p #{TS}/tsconfig.json"
  end

  desc 'Build RS'
  task :rs do
    Dir.chdir(RS) do
      sh ".#{BUILD_ENV} #{NJ_CLI} build --release"
    end
  end

  desc 'Delivery native'
  task :delivery do
    # Copy native for production
    dir_prod = "#{TS_BUILD}/native"
    FileUtils.rm_rf(dir_prod) unless !File.exists?(dir_prod)
    Dir.mkdir(dir_prod) unless File.exists?(dir_prod)
    sh "cp #{RS}/dist/index.node #{TS_BUILD}/native/index.node"
    # Copy native for tests (jasmine usage)
    dir_tests = "#{TS}/native"
    FileUtils.rm_rf(dir_tests) unless !File.exists?(dir_tests)
    Dir.mkdir(dir_tests) unless File.exists?(dir_tests)
    sh "cp #{RS}/dist/index.node #{TS}/native/index.node"
  end

  desc 'Build TS-CLI'
  task :ts_cli do
    sh "#{TSC_CLI} -p #{TS_CLI}/tsconfig.json"
    file = "#{TS_CLI}/dist/apps/rustcore/ts-bindings-cli/src/index.js"
    if OS.windows?
      #TODO
    else
      link = "#{Dir.pwd}/ts-cli"
      content = File.read(file)
      File.write(file, "#{'#!/usr/bin/env node'}\n#{content}", mode: "w")
      sh "chmod +x #{file}"
      if File.exist?(link)
        sh "rm #{link}"
      end
      sh "ln -s #{file} #{link}"
      sh "chmod +x #{link}"
    end
  end

  desc 'build all'
  task :all => ['build:rs', 'build:ts', 'build:delivery', 'build:ts_cli']
end

