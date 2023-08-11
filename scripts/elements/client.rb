# frozen_string_literal: true

require './scripts/elements/matcher'
require './scripts/elements/utils'
module Client
  DIST = Paths::CLIENT_DIST.to_s
  NODE_MODULES = "#{Paths::CLIENT}/node_modules"
  TARGETS = [DIST, NODE_MODULES].freeze

  def self.client_dist(kind)
    "#{Paths::CLIENT_DIST}/#{output(kind)}"
  end
end

namespace :client do
  desc 'clean client'
  task :clean do
    Client::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('client', "removed: #{File.basename(path)}", '')
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
      duration = Shell.timed_sh('yarn install', 'yarn install client')
      Reporter.done('client', 'installing', '', duration)
    end
  end

  desc 'Build client (prod)'
  task build_prod: [
    'client:install',
    'matcher:build',
    'utils:build',
    'ansi:build',
    'environment:check'
  ] do
    client_build_needed = ChangeChecker.changes?('client_release', Paths::CLIENT)
    if client_build_needed
      execute_client_build(:production)
    else
      Reporter.skipped('client_release', 'build in production mode', '')
    end
  end

  desc 'Build client (dev)'
  task build_dev: [
    'client:install',
    'matcher:build',
    'ansi:build',
    'utils:build'
  ] do
    client_build_needed = ChangeChecker.changes?('client_debug', Paths::CLIENT)
    if client_build_needed
      execute_client_build(:debug)
    else
      Reporter.skipped('client_debug', 'build in debug mode', '')
    end
  end

  desc 'Lint client'
  task lint: 'client:install' do
    Shell.chdir(Paths::CLIENT) do
      duration = Shell.timed_sh 'yarn run lint', 'lint client'
      duration += Shell.timed_sh 'yarn run check', 'tsc check client'
      Reporter.done('client', 'linting', '', duration)
    end
  end
end

def output(kind)
  case kind
  when :production
    'release'
  when :debug
    'debug'
  else
    raise "output #{kind} not supported"
  end
end

def yarn_target(kind)
  case kind
  when :production
    'prod'
  when :debug
    'build'
  else
    raise "target #{kind} not supported"
  end
end

def execute_client_build(kind)
  puts "execute_client_build(#{kind})"
  Shell.chdir(Paths::CLIENT) do
    duration = Shell.timed_sh "yarn run #{yarn_target(kind)}", "build client (#{output(kind)})"
    ChangeChecker.reset("client_#{kind}", Paths::CLIENT, Client::TARGETS)
    Reporter.done('client', "build in #{kind} mode", '', duration)
  end
rescue StandardError => e
  puts "An error of type #{e.class} happened, message is #{e.message}"
  ChangeChecker.clean_entry("client_#{kind}", Paths::CLIENT)
  Reporter.failed('client', "build in #{kind} mode", '')
end
