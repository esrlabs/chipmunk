# frozen_string_literal: true

module Utils
  PKG = "#{Paths::UTILS}/pkg"
  TARGET = "#{Paths::UTILS}/target"
  NODE_MODULES = "#{Paths::UTILS}/node_modules"
  TEST_OUTPUT = "#{Paths::UTILS}/test_output"
  TARGETS = [PKG, TARGET, NODE_MODULES, TEST_OUTPUT].freeze
end

namespace :utils do
  task :clean do
    Utils::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('utils', "removed: #{path}", '')
      end
    end
  end

  task :wipe_installation do
    Shell.rm_rf(Utils::NODE_MODULES)
  end

  task reinstall: ['utils:wipe_installation', 'utils:install']

  task :install do
    Shell.chdir(Paths::UTILS) do
      Reporter.log 'Installing utils libraries'
      Shell.sh 'yarn install'
      Reporter.done('utils', 'installing', '')
    end
  end

  desc 'Rebuild utils'
  task rebuild: ['utils:clean', 'utils:build'] do
    Reporter.print
  end

  desc 'Build utils'
  task build: ['environment:check', 'utils:install'] do
    changes_to_files = ChangeChecker.changes?('utils', Paths::UTILS)
    if changes_to_files
      [Utils::PKG, Utils::TARGET].each do |path|
        Shell.rm_rf(path)
        Reporter.removed('utils', path, '')
      end
      Shell.chdir(Paths::UTILS) do
        Shell.sh 'wasm-pack build --target bundler'
        ChangeChecker.reset('utils', Paths::UTILS, Utils::TARGETS)
      end
      Reporter.done('utils', "build #{Utils::TARGET}", '')
    else
      Reporter.skipped('utils', 'already built', '')
    end
    Reporter.print
  end
end
