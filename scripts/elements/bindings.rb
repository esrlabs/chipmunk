# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/env/env'
class Bindings
  DIST = "#{Paths::TS_BINDINGS}/dist"
  DIST_RS = "#{Paths::RS_BINDINGS}/dist"
  TARGET = "#{Paths::RS_BINDINGS}/target"
  SPEC = "#{Paths::TS_BINDINGS}/spec/build"
  TS_BINDINGS_LIB = "#{Paths::TS_BINDINGS}/src/native/index.node"
  TS_NODE_MODULES = "#{Paths::TS_BINDINGS}/node_modules"
  BUILD_ENV = "#{TS_NODE_MODULES}/.bin/electron-build-env"
  TARGETS = [DIST, TS_NODE_MODULES, TARGET, DIST_RS, SPEC, TS_BINDINGS_LIB].freeze

  def initialize(reinstall)
    @nj_cli = 'nj-cli'
    @reinstall = reinstall
    @installed = File.exist?(TS_NODE_MODULES)
    @changes_to_rs = ChangeChecker.has_changes?(Paths::RS_BINDINGS, [DIST_RS, TARGET])
    @changes_to_ts = ChangeChecker.has_changes?(Paths::TS_BINDINGS, [DIST, SPEC, TS_NODE_MODULES])
  end

  attr_reader :changes_to_rs, :changes_to_ts


  def self.check(consumer, reinstall, replace)
    node_modules = "#{consumer}/node_modules"
    rustcore_dest = "#{node_modules}/rustcore"
    FileUtils.mkdir_p(node_modules)
    Shell.rm_rf(rustcore_dest) if replace || !File.exist?("#{rustcore_dest}/dist") || File.symlink?(rustcore_dest)
    return if File.exist?(rustcore_dest)

    Reporter.other(self, "#{consumer} doesn't have platform", '')
    bindings = Bindings.new(reinstall)
    bindings.build
    Shell.rm_rf dest_modules
    Dir.mkdir_p rustcore_dest
    Shell.cp_r "#{Paths::TS_BINDINGS}/*", rustcore_dest
    Shell.rm_rf("#{rustcore_dest}/native")
    Shell.rm_rf("#{rustcore_dest}/node_modules")
    Shell.chdir(rustcore_dest) do
      Reporter.log "Installing rustcore production libraries for #{consumer}"
      Shell.sh 'yarn install --production'
    end
    Platform.check(rustcore_dest, false)
    Reporter.done('Bindings', 'reinstalled in production', '')
    Reporter.done('Bindings', "delivery to #{consumer}", '')
  end
end

namespace :bindings do
  task :install do
    Shell.chdir(Paths::TS_BINDINGS) do
      Reporter.log 'Installing ts-binding libraries'
      Shell.sh 'yarn install'
      Reporter.done(self, 'installing', '')
    end
  end

  task lint: 'bindings:install' do
    Shell.chdir(Paths::TS_BINDINGS) do
      Shell.sh 'yarn run lint'
      Reporter.done(self, 'linting', '')
    end
  end

  task build_spec: ['bindings:install'] do
    Shell.chdir("#{Paths::TS_BINDINGS}/spec") do
      Shell.sh "#{Bindings::TS_NODE_MODULES}/.bin/tsc -p tsconfig.json" unless File.exist?('./build')
    end
  end

  task run_tests: ['bindings:build_spec', 'bindings:build'] do
    Shell.chdir(Paths::TS_BINDINGS) do
      sh "#{Paths::JASMINE} spec/build/spec/session.jobs.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.search.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.values.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.extract.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.ranges.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.exporting.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.map.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.observe.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.indexes.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.concat.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.cancel.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.errors.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.stream.spec.js"
      sh "#{Paths::JASMINE} spec/build/spec/session.promises.spec.js"
    end
  end

  task :clean do
    Bindings::TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      end
    end
  end

  task build: 'bindings:install' do
    Environment.check
    Platform.check(Paths::TS_BINDINGS, false)

    changes_to_rs = ChangeChecker.has_changes?(Paths::RS_BINDINGS, [Bindings::DIST_RS, Bindings::TARGET])
    changes_to_ts = ChangeChecker.has_changes?(Paths::TS_BINDINGS, [Bindings::DIST, Bindings::SPEC, Bindings::TS_NODE_MODULES])
    if changes_to_rs || changes_to_ts
      Shell.chdir(Paths::RS_BINDINGS) do
        Shell.sh "#{BUILD_ENV} #{@nj_cli} build --release"
        Reporter.done(self, 'build rs bindings', '')
      end
      begin
        Shell.chdir(Paths::TS_BINDINGS) do
          Shell.sh 'yarn run build'
          Reporter.done(self, 'build ts bindings', '')
        end
      rescue StandardError
        Reporter.failed(self, 'build ts bindings', '')
        @changes_to_ts = true
        clean
        build
      end
      Shell.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{DIST}/native/index.node"
      dir_tests = "#{Paths::TS_BINDINGS}/src/native"
      mod_file = "#{dir_tests}/index.node"
      Shell.rm(mod_file)
      Shell.sh "cp #{Paths::RS_BINDINGS}/dist/index.node #{Paths::TS_BINDINGS}/src/native/index.node"
      Reporter.done(self, 'delivery', '')
    else
      Reporter.skipped(self, 'build', '')
    end
  end
end