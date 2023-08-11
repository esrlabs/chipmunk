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
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('ansi', "removed: #{path}", '')
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
      Shell.sh 'yarn install'
      Reporter.done('ansi', 'installing', '')
    end
  end

  task rebuild: ['ansi:clean', 'ansi:build']

  desc 'Build ansi'
  task build: ['environment:check', 'ansi:install'] do
    changes_to_files = ChangeChecker.changes?(Paths::ANSI)
    if changes_to_files
      [Ansi::PKG, Ansi::TARGET].each do |path|
        Shell.rm_rf(path)
        Reporter.removed('ansi', path, '')
      end
      Shell.chdir(Paths::ANSI) do
        Shell.sh 'wasm-pack build --target bundler'
        ChangeChecker.reset(Paths::ANSI, Ansi::TARGETS)
      end
      Reporter.done('ansi', "build #{Ansi::TARGET}", '')
    else
      Reporter.skipped('ansi', 'already built', '')
    end
    Reporter.print
  end
end
