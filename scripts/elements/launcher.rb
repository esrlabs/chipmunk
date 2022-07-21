class Launchers
  def initialize
    @dest = "#{Paths::LAUNCHERS}/target"
    @target = "#{Paths::LAUNCHERS}/target"
    @target_updater = OS.executable("#{Paths::LAUNCHERS}/target/release/updater")
    @target_launcher = OS.executable("#{Paths::LAUNCHERS}/target/release/launcher")
    @target_cm = OS.executable("#{Paths::LAUNCHERS}/target/release/cm")
  end

  def clean
    if File.exist?(@target)
      FileUtils.rm_rf(@target)
      Reporter.add(Jobs::Clearing, Owner::Launchers, "removed: #{@target}", '')
    end
  end

  def build
    Environment.check
    Dir.chdir(Paths::LAUNCHERS) do
      Rake.sh 'cargo build --release'
      Reporter.add(Jobs::Building, Owner::Launchers, 'building', '')
    end
  end

  def check(replace)
    build if replace || !File.exist?(@target_cm) || !File.exist?(@target_updater) || !File.exist?(@target_launcher)
  end

  def self.delivery
    File.rename(OS.executable("#{Paths::RELEASE_BIN}/chipmunk"), OS.executable("#{Paths::RELEASE_BIN}/app"))
    File.rename(OS.executable("#{Paths::RELEASE_RESOURCES}/bin/launcher"), OS.executable("#{Paths::RELEASE_RESOURCES}/bin/chipmunk"))
    FileUtils.mv(OS.executable("#{Paths::RELEASE_RESOURCES}/bin/chipmunk"), OS.executable("#{Paths::RELEASE_BIN}/chipmunk"))
    FileUtils.mv(OS.executable("#{Paths::RELEASE_RESOURCES}/bin/updater"), OS.executable("#{Paths::RELEASE_BIN}/updater"))
    FileUtils.mv(OS.executable("#{Paths::RELEASE_RESOURCES}/bin/cm"), OS.executable("#{Paths::RELEASE_BIN}/cm"))
    Reporter.add(Jobs::Release, Owner::Launchers, 'deliveried', '')
  end
end
