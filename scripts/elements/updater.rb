# frozen_string_literal: true

module Updater
  DEST = "#{Paths::UPDATER}/target"
  TARGET = OS.executable("#{Paths::UPDATER}/target/release/updater")
  TARGETS = [DEST].freeze
end

namespace :updater do
  task :clean do
    Updater::TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{File.basename(path)}", '')
      end
    end
  end

  desc 'Build updater'
  task build: 'environment:check' do
    Shell.chdir(Paths::UPDATER) do
      duration = Shell.timed_sh 'cargo +stable build --release'
      Reporter.done('updater', 'built', '', duration)
    end
    Reporter.print
  end
end
