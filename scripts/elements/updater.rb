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
        Reporter.removed(self, "removed: #{path}", '')
      end
    end
  end

  desc 'Build updater'
  task build: 'environment:check' do
    Shell.chdir(Paths::UPDATER) do
      Shell.sh 'cargo build --release'
      Reporter.done('updater', 'built', '')
    end
    Reporter.print
  end
end
