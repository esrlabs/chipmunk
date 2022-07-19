class Launchers
  def initialize
    @target = "#{Paths::LAUNCHERS}/target"
    @target_updater = OS.executable("#{Paths::LAUNCHERS}/target/release/updater")
    @target_launcher = OS.executable("#{Paths::LAUNCHERS}/target/release/launcher")
    @target_cm = OS.executable("#{Paths::LAUNCHERS}/target/release/cm")
  end

  def clean
    if File.exist?(@target)
      FileUtils.remove_dir(@target, true)
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
    if replace || !File.exist?(@target_cm) || !File.exist?(@target_updater) || !File.exist?(@target_launcher)
      build
    end
  end

end
