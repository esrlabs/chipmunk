class Envvars
  def initialize
    @repo = "#{Paths::TMP}/envvars"
    @dest = "#{Paths::TMP}/output"
    Dir.mkdir(Paths::TMP) unless File.exist?(Paths::TMP)
    ENV['ENVVARS_CRATE_EXTRACTOR_TEMP_DIR'] = "#{Paths.cwd}/#{@dest}"
    ENV['ENVVARS_CARGO_LOG_LEVEL'] = 'warning'
  end

  def clean
    if File.exist?(@repo)
      Shell.rm_rf(@repo)
      Reporter.add(Jobs::Clearing, Owner::Envvars, "removed: #{@repo}", '')
    else
      Reporter.add(Jobs::Clearing, Owner::Envvars, "doesn't exist: #{@repo}", '')
    end
  end

  def build
    clean
    Shell.chdir(Paths::TMP) do
      Shell.sh 'git clone https://github.com/esrlabs/envvars.git'
      Reporter.add(Jobs::Install, Owner::Envvars, 'cloned', '')
    end
    Shell.chdir(@repo) do
      Shell.sh 'cargo build --release'
      Reporter.add(Jobs::Building, Owner::Envvars, 'built', '')
    end
  end
end
