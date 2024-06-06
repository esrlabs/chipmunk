# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/tools/change_checker'
require './scripts/tools/reporter'

module Wasm
  PKG = "#{Paths::WASM}/pkg"
  TARGET = "#{Paths::WASM}/target"
  NODE_MODULES = "#{Paths::WASM}/node_modules"
  TEST_OUTPUT = "#{Paths::WASM}/test_output"
  TARGETS = [PKG, TARGET, NODE_MODULES, TEST_OUTPUT].freeze
end

namespace :wasm do
  task :clean do
    Wasm::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('wasm', "removed: #{File.basename(path)}", '')
      end
    end
  end

  task :wipe_installation do
    Shell.rm_rf(Wasm::NODE_MODULES)
  end

  task reinstall: ['wasm:wipe_installation', 'wasm:install']

  task :install do
    Shell.chdir(Paths::WASM) do
      Reporter.log 'Installing wasm libraries'
      duration = Shell.timed_sh("yarn install", 'yarn install wasm')
      Reporter.done('wasm', 'installing', '', duration)
    end
  end

  desc 'Build wasm'
  task build: ['environment:check', 'wasm:install'] do
    changes_to_files = ChangeChecker.changes?('wasm', Paths::WASM)
    if changes_to_files
      duration = 0
      [Wasm::PKG, Wasm::TARGET].each do |path|
        Shell.rm_rf(path)
        Reporter.removed('wasm', File.basename(path), '')
      end
      Shell.chdir(Paths::WASM) do
        duration += Shell.timed_sh 'wasm-pack build --target bundler', 'wasm-pack build wasm'
        ChangeChecker.reset('wasm', Paths::WASM, Wasm::TARGETS)
      end
      Reporter.done('wasm', "build #{Wasm::TARGET}", '', duration)
    else
      Reporter.skipped('wasm', 'already built', '')
    end
    Reporter.print
  end

  task test_karma: 'wasm:install' do
    Reporter.print
    Shell.chdir("#{Paths::WASM}/spec") do
      Shell.timed_sh 'npm run test', 'npm test wasm'
    end
  end

  task :test_rust do
    Reporter.print
    Shell.chdir(Paths::WASM) do
      Shell.timed_sh 'wasm-pack test --node', 'wasm-pack test wasm-bindings'
    end
  end

  desc 'run wasm tests'
  task test: ['wasm:test_karma', 'wasm:test_rust']
end
