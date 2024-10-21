# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/tools/change_checker'
require './scripts/tools/reporter'
require 'fileutils'

module Protocol
  PKG = "#{Paths::PROTOCOL_WASM}/pkg"
  OUTPUT = "#{Paths::PROTOCOL_GEN}/output"
  TS_DEST = "#{Paths::TS_BINDINGS}/src/protocol"
  TARGET = "#{Paths::PROTOCOL_WASM}/target"
  TARGETS = [PKG, TARGET].freeze
end

namespace :protocol do
  task :clean do
    Protocol::TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('protocol', "removed: #{File.basename(path)}", '')
      end
    end
  end


  desc 'Build protocol'
  task build: ['environment:check'] do
    duration = 0
    # Cleanup
    [Protocol::PKG, Protocol::TARGET, Protocol::OUTPUT, Protocol::TS_DEST].each do |path|
      Shell.rm_rf(path)
      Reporter.removed('protocol', File.basename(path), '')
    end
    # Generate *.ts files based on protobuf scheme
    Shell.chdir(Paths::PROTOCOL_GEN) do
      ENV['TSLINK_BUILD'] = 'true'
      duration += Shell.timed_sh 'cargo clean', 'cleaning proto'
      duration += Shell.timed_sh 'cargo build', 'generating proto'
      ENV['TSLINK_BUILD'] = 'false'
    end
    # Copy *.ts files into ts-bindings
    FileUtils.mkdir_p "#{Protocol::TS_DEST}"
    FileUtils.cp_r("#{Protocol::OUTPUT}/.", "#{Protocol::TS_DEST}/.", verbose: true)
    # Generate wasm module
    Shell.chdir(Paths::PROTOCOL_WASM) do
      duration += Shell.timed_sh 'wasm-pack build --target nodejs', 'wasm-pack build --target nodejs'
      ChangeChecker.reset('protocol', Paths::PROTOCOL_WASM, Protocol::TARGETS)
    end
    Reporter.done('protocol', "build #{Protocol::TARGET}", '', duration)
    Reporter.print
  end

end
