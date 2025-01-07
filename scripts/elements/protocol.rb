# frozen_string_literal: true

module Protocol
  PKG = "#{Paths::PROTOCOL}/pkg"
  TARGET = "#{Paths::PROTOCOL}/target"
  TARGETS = [PKG, TARGET].freeze
end

namespace :protocol do

  task :clean do
    Protocol::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('protocol', "removed: #{File.basename(path)}", '')
      end
    end
  end

  task rebuild: ['protocol:clean', 'protocol:build']

  desc 'build protocol'
  task build: ['environment:check'] do
    Shell.rm_rf(Protocol::PKG) if @rebuild
    Reporter.removed('protocol', File.basename(Protocol::PKG), '')
    begin
      Shell.chdir(Paths::PROTOCOL) do
        duration = Shell.timed_sh 'wasm-pack build --target nodejs', 'build protocol'
        Reporter.done('protocol', 'build', '', duration)
      end
    rescue StandardError
      Reporter.failed('protocol', 'build', '')
    end
  end

  desc 'Lint protocol'
  task lint: 'protocol:install' do
    Shell.chdir(Paths::PROTOCOL) do
      duration = Shell.timed_sh 'cargo clippy', 'lint protocol'
      Reporter.done('protocol', 'linting', '', duration)
    end
  end

end
