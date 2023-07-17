# frozen_string_literal: true

module Matcher
  PKG = "#{Paths::MATCHER}/pkg"
  TARGET = "#{Paths::MATCHER}/target"
  NODE_MODULES = "#{Paths::MATCHER}/node_modules"
  TEST_OUTPUT = "#{Paths::MATCHER}/test_output"
  TARGETS = [PKG, TARGET, NODE_MODULES, TEST_OUTPUT].freeze
end

namespace :matcher do
  task :clean do
    Matcher::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('matcher', "removed: #{path}", '')
      end
    end
  end

  task :wipe_installation do
    Shell.rm_rf(Matcher::NODE_MODULES)
  end

  task reinstall: ['matcher:wipe_installation', 'matcher:install']

  task :install do
    Shell.chdir(Paths::MATCHER) do
      Reporter.log 'Installing matcher libraries'
      Shell.sh 'yarn install'
      Reporter.done('matcher', 'installing', '')
    end
  end

  desc 'Build matcher'
  task build: ['environment:check', 'matcher:install'] do
    changes_to_files = ChangeChecker.changes?('matcher', Paths::MATCHER)
    if changes_to_files
      [Matcher::PKG, Matcher::TARGET].each do |path|
        Shell.rm_rf(path)
        Reporter.removed('matcher', path, '')
      end
      Shell.chdir(Paths::MATCHER) do
        Shell.sh 'wasm-pack build --target bundler'
        ChangeChecker.reset('matcher', Paths::MATCHER, Matcher::TARGETS)
      end
      Reporter.done('matcher', "build #{Matcher::TARGET}", '')
    else
      Reporter.skipped('matcher', 'already built', '')
    end
    Reporter.print
  end

  task test_karma: 'matcher:install' do
    Reporter.print
    Shell.chdir("#{Paths::MATCHER}/spec") do
      sh 'npm run test'
    end
  end

  task :test_rust do
    Reporter.print
    Shell.chdir(Paths::MATCHER) do
      sh 'wasm-pack test --node'
    end
  end

  desc 'run matcher tests'
  task test: ['matcher:test_karma', 'matcher:test_rust']
end
