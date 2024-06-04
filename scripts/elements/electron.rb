# frozen_string_literal: true

require './scripts/elements/indexer'
require 'pathname'

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
        Reporter.removed(self, "removed: #{File.basename(path)}", '')
      end
    end
  end

  task :clean_installation do
    Shell.rm_rf(Electron::NODE_MODULES)
  end

  task reinstall: ['electron:clean_installation', 'electron:install']

  task :install do
    puts 'trying to install electron yarn stuff'
    Shell.chdir(Paths::ELECTRON) do
      Reporter.log 'Installing Electron libraries'
      duration = Shell.timed_sh("yarn install", 'yarn install electron')
      Reporter.done('electron', 'installing', '', duration)
    end
  end

  task copy_client_debug: ['client:build_dev'] do
    FileUtils.mkdir_p(Paths::ELECTRON_CLIENT_DEST)
    duration = Shell.cp_r "#{Client.client_dist(:debug)}/.", Paths::ELECTRON_CLIENT_DEST, 'copy client to electron'
    short_dest = Reporter.short_path(Paths::ELECTRON_CLIENT_DEST)
    Reporter.done('client', "copy client to #{short_dest}", '', duration)
  end

  task copy_client_prod: ['client:build_prod'] do
    FileUtils.mkdir_p(Paths::ELECTRON_CLIENT_DEST)
    duration = Shell.cp_r "#{Client.client_dist(:production)}/.", Paths::ELECTRON_CLIENT_DEST, 'copy client to electron'
    short_dest = Reporter.short_path(Paths::ELECTRON_CLIENT_DEST)
    Reporter.done('client', "copy client to #{short_dest}", '', duration)
  end

  task do_build: 'updater:build' do
    changes_to_electron = ChangeChecker.changes?('electron', Paths::ELECTRON)
    if changes_to_electron
      begin
        Shell.chdir(Paths::ELECTRON) do
          duration = Shell.timed_sh 'yarn run build', 'build electron'
          ChangeChecker.reset('electron', Paths::ELECTRON, Electron::TARGETS)
          Reporter.done('electron', 'built', '', duration)
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
    'bindings:build',
    'electron:install',
    'electron:copy_client_debug',
    'environment:check',
    'electron:do_build'
  ] do
    Reporter.print
  end

  desc 'build production version of electron'
  task build_prod: [
    'bindings:build',
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
      duration = Shell.timed_sh 'yarn run lint', 'lint electron'
      Reporter.done('electron', 'linting', '', duration)
    end
  end

  desc 'tsc compile check electron'
  task check: ['electron:install', 'wasm:build', 'bindings:build'] do
    Shell.chdir(Paths::ELECTRON) do
      duration = Shell.timed_sh 'yarn run check', 'tsc check electron'
      Reporter.done('electron', 'check', '', duration)
    end
  end
end
