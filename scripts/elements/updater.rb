class Updater
  def initialize
    @dest = "#{Paths::UPDATER}/target"
    @target = OS.executable("#{Paths::UPDATER}/target/release/updater")
    @targets = [@dest]
  end

  def clean
    @targets.each do |path|
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed(self, "removed: #{path}", '')
      else
        Reporter.other(self, "doesn't exist: #{path}", '')
      end
    end
  end

  def build
    Environment.check
    Shell.chdir(Paths::UPDATER) do
      Shell.sh 'cargo build --release'
      Reporter.done(self, "built", '')
    end
  end

  def check(replace)
    replace || !File.exist?(@target) ? build : Reporter.skipped(self, "build", '')
  end
end
