# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/tools/change_checker'
require './scripts/tools/reporter'

module Ansi
  PKG = "#{Paths::ANSI}/pkg"
  TARGET = "#{Paths::ANSI}/target"
  NODE_MODULES = "#{Paths::ANSI}/node_modules"
  TEST_OUTPUT = "#{Paths::ANSI}/test_output"
  TARGETS = [PKG, TARGET, NODE_MODULES, TEST_OUTPUT].freeze
end

namespace :ansi do
  task :clean do
    Ansi::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('ansi', "removed: #{File.basename(path)}", '')
      end
    end
  end

  task :wipe_installation do
    Shell.rm_rf(Ansi::NODE_MODULES)
  end

  task reinstall: ['ansi:wipe_installation', 'ansi:install']

  task :install do
    Shell.chdir(Paths::ANSI) do
      Reporter.log 'Installing ansi libraries'
      duration = Shell.timed_sh('yarn install', 'yarn install ansi')
      Reporter.done('ansi', 'installing', '', duration)
    end
  end

  desc 'Build ansi'
  task build: ['environment:check', 'ansi:install'] do
    changes_to_files = ChangeChecker.changes?('ansi', Paths::ANSI)
    if changes_to_files
      duration = 0
      [Ansi::PKG, Ansi::TARGET].each do |path|
        Shell.rm_rf(path)
        Reporter.removed('ansi', File.basename(path), '')
      end
      Shell.chdir(Paths::ANSI) do
        duration += Shell.timed_sh 'wasm-pack build --target bundler', 'wasm-pack build ansi'
        ChangeChecker.reset('ansi', Paths::ANSI, Ansi::TARGETS)
      end
      Reporter.done('ansi', "build #{Ansi::TARGET}", '', duration)
    else
      Reporter.skipped('ansi', 'already built', '')
    end
    Reporter.print
  end

  task test_karma: 'ansi:install' do
    Reporter.print
    Shell.chdir("#{Paths::ANSI}/spec") do
      Shell.timed_sh 'npm run test', 'npm test ansi'
    end
  end

  task :test_rust do
    Reporter.print
    Shell.chdir(Paths::ANSI) do
      Shell.timed_sh 'wasm-pack test --node', 'wasm-pack test ansi'
    end
  end

  desc 'run ansi tests'
  task test: ['ansi:test_karma', 'ansi:test_rust']
end
