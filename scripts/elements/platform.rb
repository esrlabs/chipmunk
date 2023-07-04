# frozen_string_literal: true

module Platform
  DIST = "#{Paths::PLATFORM}/dist"
  NODE_MODULES = "#{Paths::PLATFORM}/node_modules"
  TARGETS = [DIST, NODE_MODULES].freeze
end

namespace :platform do
  task :clean do
    Platform::TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('platform', "removed: #{path}", '')
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
      Shell.sh 'yarn install'
      Reporter.done('platform', 'installing', '')
    end
  end

  task rebuild: ['platform:clean', 'platform:build']

  desc 'build platform'
  task build: ['platform:install', 'environment:check'] do
    Shell.rm_rf(Platform::DIST) if @rebuild
    Reporter.removed('platform', Platform::DIST, '')
    begin
      Shell.chdir(Paths::PLATFORM) do
        Shell.sh 'yarn run build'
        Reporter.done('platform', 'build', '')
      end
    rescue StandardError
      Reporter.failed('platform', 'build', '')
    end
  end

  desc 'Lint platform'
  task lint: 'platform:install' do
    Shell.chdir(Paths::PLATFORM) do
      Shell.sh 'yarn run lint'
      Reporter.done('platform', 'linting', '')
    end
  end
end
