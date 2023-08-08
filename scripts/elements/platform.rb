# frozen_string_literal: true

module Platform
  DIST = "#{Paths::PLATFORM}/dist"
  NODE_MODULES = "#{Paths::PLATFORM}/node_modules"
  TARGETS = [DIST, NODE_MODULES].freeze
end

namespace :platform do
  task :clean do
    Platform::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('platform', "removed: #{File.basename(path)}", '')
      end
    end
  end

  task :wipe_installation do
    Shell.rm_rf(Platform::NODE_MODULES)
  end

  task reinstall: ['platform:wipe_installation', 'platform:install']

  task :install do
    Shell.chdir(Paths::PLATFORM) do
      Reporter.log 'Installing platform libraries'
      duration = Shell.timed_sh('yarn install', 'yarn install platform')
      Reporter.done('platform', 'installing', '', duration)
    end
  end

  task rebuild: ['platform:clean', 'platform:build']

  desc 'build platform'
  task build: ['platform:install', 'environment:check'] do
    Shell.rm_rf(Platform::DIST) if @rebuild
    Reporter.removed('platform', File.basename(Platform::DIST), '')
    begin
      Shell.chdir(Paths::PLATFORM) do
        duration = Shell.timed_sh 'yarn run build', 'build platform'
        Reporter.done('platform', 'build', '', duration)
      end
    rescue StandardError
      Reporter.failed('platform', 'build', '')
    end
  end

  desc 'Lint platform'
  task lint: 'platform:install' do
    Shell.chdir(Paths::PLATFORM) do
      duration = Shell.timed_sh 'yarn run lint', 'lint platform'
      Reporter.done('platform', 'linting', '', duration)
    end
  end

  desc 'tsc comile check platform'
  task check: 'platform:install' do
    Shell.chdir(Paths::PLATFORM) do
      duration = Shell.timed_sh 'yarn run check', 'tsc check platform'
      Reporter.done('platform', 'check', '', duration)
    end
  end
end
