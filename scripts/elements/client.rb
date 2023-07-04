# frozen_string_literal: true

require './scripts/elements/matcher'
require './scripts/elements/utils'
module Client
  DIST = Paths::CLIENT_DIST.to_s
  NODE_MODULES = "#{Paths::CLIENT}/node_modules"
  TARGETS = [DIST, NODE_MODULES].freeze
end

namespace :client do
  desc 'clean client'
  task :clean do
    Client::TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('client', "removed: #{path}", '')
      end
    end
    Shell.rm_rf(Paths::ELECTRON_CLIENT_DEST)
  end

  task :wipe_installation do
    Shell.rm_rf(Client::NODE_MODULES)
  end

  task reinstall: ['client:wipe_installation', 'client:install']

  desc 'Install client'
  task :install do
    Shell.chdir(Paths::CLIENT) do
      Reporter.log 'Installing client libraries'
      Shell.sh 'yarn install'
      Reporter.done('client', 'installing', '')
    end
  end

  desc 'Rebuild client (prod)'
  task rebuild_prod: ['client:clean', 'client:build_prod']

  desc 'Rebuild client (dev)'
  task rebuild_dev: ['client:clean', 'client:build_dev']

  desc 'Build client (prod)'
  task build_prod: [
    'client:install',
    'matcher:build',
    'utils:build',
    'ansi:build',
    'environment:check'
  ] do
    client_build_needed = ChangeChecker.changes?(Paths::CLIENT)
    # TODO: Oli: check if this is still needed: client_build_needed = changes_to_files || matcher.changes_to_files || ansi.changes_to_files || utils.changes_to_files
    if client_build_needed
      begin
        Shell.chdir(Paths::CLIENT) do
          Shell.sh 'yarn run prod'
          ChangeChecker.reset(Paths::CLIENT, Client::TARGETS)
          Reporter.done('client', 'build in production mode', '')
        end
        client_dist = "#{Paths::CLIENT_DIST}/release"
        Dir.mkdir_p(Paths::ELECTRON_DIST)
        sh "cp -r #{client_dist} #{Paths::ELECTRON_DIST}"
      rescue StandardError
        Reporter.failed('client', 'build in production mode', '')
      end
    else
      Reporter.skipped('client', 'build in production mode', '')
    end
  end

  desc 'Build client (dev)'
  task build_dev: [
    'client:install',
    'matcher:build',
    'ansi:build',
    'utils:build'
  ] do
    client_build_needed = ChangeChecker.changes?(Paths::CLIENT)
    if client_build_needed
      begin
        Shell.chdir(Paths::CLIENT) do
          Shell.sh 'yarn run build'
          ChangeChecker.reset(Paths::CLIENT, Client::TARGETS)
          Reporter.done('client', 'build in developing mode', '')
        end
        client_dist = "#{Paths::CLIENT_DIST}/debug"
        Dir.mkdir_p(Paths::ELECTRON_DIST)
        sh "cp -r #{client_dist} #{Paths::ELECTRON_DIST}"
      rescue StandardError
        Reporter.failed('client', 'build in developing mode', '')
      end
    else
      Reporter.skipped('client', 'build in developing mode', '')
    end
  end

  desc 'Delivery client'
  task :delivery do
    client_dist = "#{Paths::CLIENT_DIST}/client"
    Dir.mkdir_p(Paths::ELECTRON_DIST)
    sh "cp -r #{client_dist} #{Paths::ELECTRON_DIST}"
  end

  desc 'Lint client'
  task lint: 'client:install' do
    Shell.chdir(Paths::CLIENT) do
      Shell.sh 'yarn run lint'
      Reporter.done('client', 'linting', '')
    end
  end
end
