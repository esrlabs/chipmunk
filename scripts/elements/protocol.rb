# frozen_string_literal: true

require './scripts/env/paths'
require './scripts/tools/change_checker'
require './scripts/tools/reporter'

module Protocol
  PKG = "#{Paths::PROTOCOL_WASM}/pkg"
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
    changes_to_files = ChangeChecker.changes?('protocol', Paths::PROTOCOL_WASM)
    if changes_to_files || !File.exist?(Protocol::PKG)
      duration = 0
      [Protocol::PKG, Protocol::TARGET].each do |path|
        Shell.rm_rf(path)
        Reporter.removed('protocol', File.basename(path), '')
      end
      Shell.chdir(Paths::PROTOCOL_WASM) do
        duration += Shell.timed_sh 'wasm-pack build --target nodejs', 'wasm-pack build --target nodejs'
        ChangeChecker.reset('protocol', Paths::PROTOCOL_WASM, Protocol::TARGETS)
      end
      Reporter.done('protocol', "build #{Protocol::TARGET}", '', duration)
    else
      Reporter.skipped('protocol', 'already built', '')
    end
    Reporter.print
  end

end
