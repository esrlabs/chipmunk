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
        Reporter.add(Jobs::Clearing, Owner::Updater, "removed: #{path}", '')
      else
        Reporter.add(Jobs::Clearing, Owner::Updater, "doesn't exist: #{path}", '')
      end
    end
  end

  def build
    Environment.check
    Shell.chdir(Paths::UPDATER) do
      Shell.sh 'cargo build --release'
      Reporter.add(Jobs::Building, Owner::Updater, 'built', '')
    end
  end

  def check(replace)
    build if replace || !File.exist?(@target)
  end
end
