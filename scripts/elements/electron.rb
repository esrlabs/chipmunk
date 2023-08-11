# frozen_string_literal: true

require './scripts/elements/indexer'
module Electron
  DIST = "#{Paths::ELECTRON}/dist"
  RELEASE = "#{Paths::ELECTRON}/release"
  NODE_MODULES = "#{Paths::ELECTRON}/node_modules"
  TARGETS = [DIST, RELEASE, NODE_MODULES].freeze
end

namespace :electron do
  task :clean do
    Electron::TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      end
    end
  end

  task :clean_installation do
    Shell.rm_rf(Electron::NODE_MODULES)
  end

  task reinstall: ['electron:clean_installation', 'electron:install']

  desc 'Install electron'
  task :install do
    Shell.chdir(Paths::ELECTRON) do
      Reporter.log 'Installing Electron libraries'
      Shell.sh 'yarn install'
      Reporter.done(self, 'installing', '')
    end
  end

  task copy_tsbindings_and_platform: ['bindings:build', 'platform:build'] do
    rustcore_dest = "#{Paths::ELECTRON}/node_modules/rustcore"
    Shell.rm_rf(rustcore_dest)
    FileUtils.mkdir_p rustcore_dest
    puts '1...'
    FileUtils.cp_r Dir.glob("#{Paths::TS_BINDINGS}/*"), rustcore_dest
    puts '2...'
    Shell.rm_rf("#{rustcore_dest}/native")
    puts '3...'
    Shell.rm_rf("#{rustcore_dest}/node_modules")
    puts '4...'
    Shell.chdir(rustcore_dest) do
      puts '5...'
      Reporter.log 'Installing rustcore production libraries for electron'
      Shell.sh 'yarn install --production'
    end
    FileUtils.cp_r(Paths::PLATFORM, "#{rustcore_dest}/node_modules")
  end

  task copy_client_debug: 'client:build_dev' do
    path_to_client = "#{Paths::CLIENT_DIST}/debug'}"
    if File.exist?(path_to_client)
      # TODO: Oli: check if this is sufficient
      Reporter.skipped('Client', 'client already exist', '')
      return
    end
    FileUtils.mkdir_p(Electron::DIST)
    FileUtils.cp_r path_to_client, Electron::DIST
    Reporter.done('Client', "delivery to #{Electron::DIST}", '')
  end

  # def self.delivery(dest, prod, replace)
  task copy_client_prod: 'client:build_prod' do
    path_to_client = "#{Paths::CLIENT_DIST}/release'}"
    # TODO: Oli: check if this is sufficient
    if File.exist?(path_to_client)
      Reporter.skipped('Client', 'client already exist', '')
      return
    end
    FileUtils.mkdir_p(Electron::DIST)
    FileUtils.cp_r path_to_client, Electron::DIST
    Reporter.done('Client', "delivery to #{Electron::DIST}", '')
  end

  task copy_platform: 'platform:build' do
    platform_dest = "#{Electron::NODE_MODULES}/platform"
    Shell.rm_rf(platform_dest)
    FileUtils.cp_r(Paths::PLATFORM, Electron::NODE_MODULES)
  end

  task check_environment_and_platform: ['environment:check', 'electron:copy_platform']

  task do_build: 'updater:build' do
    changes_to_electron = ChangeChecker.changes?(Paths::ELECTRON)
    if changes_to_electron
      begin
        Shell.chdir(Paths::ELECTRON) do
          Shell.sh 'yarn run build'
          ChangeChecker.reset(Paths::ELECTRON, TARGETS)
          Reporter.done('electron', 'built', '')
        end
      rescue StandardError
        Reporter.failed('electron', 'build', '')
      end
      Shell.sh "cp #{Paths::ELECTRON}/package.json #{DIST}/package.json"
    else
      Reporter.skipped('electron', 'build', '')
    end
  end

  desc 'rebuild dev version of electron'
  task rebuild_debug: ['electron:clean', 'electron:build_dev'] do
    Reporter.print
  end

  desc 'rebuild production version of electron'
  task rebuild_prod: ['electron:clean', 'electron:build_prod'] do
    Reporter.print
  end

  desc 'build dev version of electron'
  task build_dev: [
    'electron:copy_tsbindings_and_platform',
    'electron:install',
    'electron:copy_client_debug',
    'environment:check',
    'electron:do_build'
  ] do
    Reporter.print
  end

  desc 'build production version of electron'
  task build_prod: [
    'electron:copy_tsbindings_and_platform',
    'electron:install',
    'electron:copy_client_prod',
    'environment:check',
    'electron:do_build'
  ] do
    Reporter.print
  end

  desc 'Lint electron'
  task lint: 'electron:install' do
    Shell.chdir(Paths::ELECTRON) do
      Shell.sh 'yarn run lint'
      Reporter.done('electron', 'linting', '')
    end
  end
end
