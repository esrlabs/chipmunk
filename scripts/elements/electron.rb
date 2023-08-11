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
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
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

  task :install do
    Shell.chdir(Paths::ELECTRON) do
      Reporter.log 'Installing Electron libraries'
      Shell.sh 'yarn install'
      Reporter.done('electron', 'installing', '')
    end
  end

  task copy_tsbindings_and_platform: ['bindings:build', 'platform:build'] do
    rustcore_dest = "#{Paths::ELECTRON}/node_modules/rustcore"
    Shell.rm_rf(rustcore_dest)
    FileUtils.mkdir_p rustcore_dest
    # FileUtils.cp_r Dir["#{Paths::TS_BINDINGS}/*"], rustcore_dest
    FileUtils.cp_r Dir["#{Paths::TS_BINDINGS}/*"].reject{ |f| File.basename(f) == 'node_modules' }, rustcore_dest
    Shell.rm_rf("#{rustcore_dest}/native")
    platform_dest = "#{rustcore_dest}/node_modules/platform"
    Shell.rm_rf(platform_dest)
    FileUtils.mkdir_p platform_dest
    FileUtils.cp_r Dir["#{Paths::PLATFORM}/*"].reject { |f| File.basename(f) == 'node_modules' }, platform_dest
  end

  task copy_client_debug: 'client:build_dev' do
    path_to_client = "#{Paths::CLIENT_DIST}/debug"
    FileUtils.rm_f Electron::DIST
    FileUtils.mkdir_p(Electron::DIST)
    FileUtils.cp_r path_to_client, Electron::DIST
    Reporter.done('Client', "delivery to #{Electron::DIST}", '')
  end

  # def self.delivery(dest, prod, replace)
  task copy_client_prod: 'client:build_prod' do
    path_to_client = "#{Paths::CLIENT_DIST}/release"
    FileUtils.rm_f Electron::DIST
    FileUtils.mkdir_p(Electron::DIST)
    FileUtils.cp_r path_to_client, Electron::DIST
    Reporter.done('Client', "delivery to #{Electron::DIST}", '')
  end

  task copy_platform: 'platform:build' do
    platform_dest = "#{Electron::NODE_MODULES}/platform"
    Shell.rm_rf(platform_dest)
    FileUtils.mkdir_p platform_dest
    FileUtils.cp_r Dir["#{Paths::PLATFORM}/*"].reject { |f| File.basename(f) == 'node_modules' }, platform_dest
  end

  task check_environment_and_platform: ['environment:check', 'electron:copy_platform']

  task do_build: 'updater:build' do
    changes_to_electron = ChangeChecker.changes?('electron', Paths::ELECTRON)
    if changes_to_electron
      begin
        Shell.chdir(Paths::ELECTRON) do
          Shell.sh 'yarn run build'
          ChangeChecker.reset('electron', Paths::ELECTRON, Electron::TARGETS)
          Reporter.done('electron', 'built', '')
        end
      rescue StandardError => e
        puts "An error of type #{e.class} happened, message is #{e.message}"
        Reporter.failed('electron', 'build', e.message.to_s)
      end
      FileUtils.cp "#{Paths::ELECTRON}/package.json", Electron::DIST
    else
      Reporter.skipped('electron', 'build', '')
    end
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
