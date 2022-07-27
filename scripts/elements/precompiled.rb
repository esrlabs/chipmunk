class Precompiled
  def initialize
    @dest = "#{Paths::PRECOMPILED}/target"
    @target = "#{Paths::PRECOMPILED}/target"
    @target_updater = OS.executable("#{Paths::PRECOMPILED}/target/release/updater")
    @target_cm = OS.executable("#{Paths::PRECOMPILED}/target/release/cm")
  end

  def clean
    if File.exist?(@target)
      Shell.rm_rf(@target)
      Reporter.add(Jobs::Clearing, Owner::Precompiled, "removed: #{@target}", '')
    end
  end

  def build
    Environment.check
    Shell.chdir(Paths::PRECOMPILED) do
      Shell.sh 'cargo build --release'
      Reporter.add(Jobs::Building, Owner::Precompiled, 'building', '')
    end
  end

  def check(replace)
    build if replace || !File.exist?(@target_cm) || !File.exist?(@target_updater)
  end
end
