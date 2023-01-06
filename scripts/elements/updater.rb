class Updater
  def initialize
    @dest = "#{Paths::UPDATER}/target"
    @target = OS.executable("#{Paths::UPDATER}/target/release/updater")
  end

  def clean
    if File.exist?(@dest)
      Shell.rm_rf(@dest)
      Reporter.add(Jobs::Clearing, Owner::Updater, "removed: #{@dest}", '')
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
