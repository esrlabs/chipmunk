# frozen_string_literal: true

class Updater
  DEST = "#{Paths::UPDATER}/target"
  TARGET = OS.executable("#{Paths::UPDATER}/target/release/updater")
  TARGETS = [DEST].freeze

  def self.clean
    TARGETS.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      end
    end
  end

  def self.build
    Environment.check
    Shell.chdir(Paths::UPDATER) do
      Shell.sh 'cargo build --release'
      Reporter.done(self, 'built', '')
    end
  end

  def self.check(replace)
    replace || !File.exist?(TARGET) ? build : Reporter.skipped(self, 'build', '')
  end
end
