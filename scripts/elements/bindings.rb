# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/env/env'
require './scripts/tools/shell'
module Bindings
  DIST = "#{Paths::TS_BINDINGS}/dist"
  DIST_RS = "#{Paths::RS_BINDINGS}/dist"
  TARGET = "#{Paths::RS_BINDINGS}/target"
  SPEC = "#{Paths::TS_BINDINGS}/spec/build"
  TS_BINDINGS_LIB = "#{Paths::TS_BINDINGS}/src/native/index.node"
  TS_NODE_MODULES = "#{Paths::TS_BINDINGS}/node_modules"
  BUILD_ENV = "#{TS_NODE_MODULES}/.bin/electron-build-env"
  TARGETS = [DIST, TS_NODE_MODULES, TARGET, DIST_RS, SPEC, TS_BINDINGS_LIB].freeze

  def self.run_jasmine_spec(spec)
    ENV['ELECTRON_RUN_AS_NODE'] = '1'
    Shell.chdir(Paths::TS_BINDINGS) do
      Shell.sh "#{Paths::JASMINE} spec/build/spec/session.#{spec}.spec.js"
    end
  end
end

namespace :bindings do
  task :install do
    Shell.chdir(Paths::TS_BINDINGS) do
      Reporter.log 'Installing ts-binding libraries'
      duration = Shell.timed_sh("yarn install", 'yarn install bindings')
      Reporter.done('bindings', 'installing', '', duration)
    end
  end

  desc 'Lint TS bindings'
  task lint: 'bindings:install' do
    Shell.chdir(Paths::TS_BINDINGS) do
      duration = Shell.timed_sh 'yarn run lint', 'lint ts-bindings'
      Reporter.done('bindings', 'linting', '', duration)
    end
  end

  task build_spec: ['bindings:install'] do
    Shell.chdir("#{Paths::TS_BINDINGS}/spec") do
      Shell.sh "#{Bindings::TS_NODE_MODULES}/.bin/tsc -p tsconfig.json" unless File.exist?('./build')
    end
  end

  namespace :test do
    test_specs = %w[
      jobs
      search
      values
      extract
      ranges
      exporting
      map
      observe
      indexes
      concat
      cancel
      errors
      stream
      promises
    ]
    test_specs.each do |spec|
      desc "run jasmine #{spec}-spec"
      task spec.to_sym => ['bindings:build_spec', 'bindings:build'] do
        Bindings.run_jasmine_spec(spec)
      end
    end

    desc 'run binding tests'
    task all: test_specs.map { |spec| "bindings:test:#{spec}" }
  end

  desc 'clean bindings'
  task :clean do
    Bindings::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('bindings', "removed: #{File.basename(path)}", '')
      end
    end
  end

  task :build_rs_bindings do
    Shell.chdir(Paths::RS_BINDINGS) do
      duration = Shell.timed_sh "#{Bindings::BUILD_ENV} nj-cli build --release", 'nj-cli build bindings'
      Reporter.done('bindings', 'build rs bindings', '', duration)
    end
    FileUtils.mkdir_p "#{Bindings::DIST}/native"
    FileUtils.cp "#{Paths::RS_BINDINGS}/dist/index.node", "#{Bindings::DIST}/native/index.node"
    dir_tests = "#{Paths::TS_BINDINGS}/src/native"
    mod_file = "#{dir_tests}/index.node"
    FileUtils.rm_f(mod_file)
    FileUtils.cp "#{Paths::RS_BINDINGS}/dist/index.node", "#{Paths::TS_BINDINGS}/src/native/index.node"
  end

  task :build_ts_bindings do
    changes_to_ts = ChangeChecker.changes?('bindings', Paths::TS_BINDINGS)
    if changes_to_ts
      begin
        duration = 0
        Shell.chdir(Paths::TS_BINDINGS) do
          duration += Shell.timed_sh 'yarn run build', 'build ts-bindings'
          ChangeChecker.reset('bindings', Paths::TS_BINDINGS,
                              [Bindings::DIST, Bindings::SPEC, Bindings::TS_NODE_MODULES])
          Reporter.done('bindings', 'build ts bindings', '', duration)
        end
        duration += ChangeChecker.create_changelist('bindings', Paths::TS_BINDINGS, Bindings::TARGETS)
        Reporter.done('bindings', 'delivery', '', duration)
      rescue StandardError => e
        puts "An error of type #{e.class} happened, message is #{e.message}"
        Reporter.failed('bindings', 'build ts bindings', '')
      end
    else
      Reporter.skipped('bindings', 'build', '')
    end
    Reporter.print
  end

  desc 'Build bindings'
  task build: [
    'platform:build',
    'bindings:install',
    'environment:check',
    'bindings:build_rs_bindings',
    'bindings:build_ts_bindings'
  ]
end
