require 'dotenv/load'

class Release
  def initialize(prod, compress)
    @prod = prod
    @compress = compress
  end

  def clean
    if File.exist?(Paths::RELEASE)
      Shell.rm_rf(Paths::RELEASE)
      Reporter.add(Jobs::Clearing, Owner::Release, "removed: #{Paths::RELEASE}", '')
    else
      Reporter.add(Jobs::Clearing, Owner::Release, "doesn't exist: #{Paths::RELEASE}", '')
    end
  end

  def build
    Environment.check
    clean
    if @prod
      Rake::Task['rebuild:prod'].invoke
    else
      Rake::Task['build:dev'].invoke
    end
    Updater.new.check(true)
    Shell.chdir(Paths::ELECTRON) do
      set_envvars
      Shell.sh build_cmd
      Reporter.add(Jobs::Building, Owner::Release, 'built', '')
    end
    snapshot
    Reporter.add(Jobs::Release, Owner::Release, "done: #{Paths::RELEASE_BUILD}", '')
    if @compress
      Compressor.new(Paths::RELEASE_BUILD, release_file_name).compress
    else
      Reporter.add(Jobs::Skipped, Owner::Release, 'compressing is skipped', '')
    end
  end

  def build_cmd
    if OS.mac?
      if ENV.key?('APPLEID') && ENV.key?('APPLEIDPASS') && !ENV.key?('SKIP_NOTARIZE')
        './node_modules/.bin/electron-builder --mac --dir'
      else
        './node_modules/.bin/electron-builder --mac --dir -c.mac.identity=null'
      end
    elsif OS.linux?
      './node_modules/.bin/electron-builder --linux --dir'
    else
      './node_modules/.bin/electron-builder --win --dir'
    end
  end

  def set_envvars
    if ENV.key?('SKIP_NOTARIZE')
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
      return
    end
    if OS.mac?
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'true' if ENV.key?('APPLEID') && ENV.key?('APPLEIDPASS')
    elsif OS.linux?
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
    else
      ENV['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
    end
  end

  def snapshot
    if OS.mac?
      Reporter.add(Jobs::Skipped, Owner::Release, "build for darwin does'n require snapshot", '')
      return
    end
    snapshot_file = "#{Paths::RELEASE_BIN}/.release"
    File.delete(snapshot_file) if File.exist?(snapshot_file)
    lines = ".release\n"
    Dir.foreach(Paths::RELEASE_BIN) do |entry|
      lines = "#{lines}#{entry}\n" if entry != '.' && entry != '..'
    end
    File.open(snapshot_file, 'a') do |fd|
      fd.puts lines
      fd.flush
      fd.close
    end
    Reporter.add(Jobs::Other, Owner::Release, 'files snapshot has been created', '')
  end

  def version
    package = JSON.parse(File.read("#{Paths::ELECTRON}/package.json"))
    package['version']
  end

  def release_file_name
    prefix = OS.prefix
    prefix += '64' if prefix == 'win'
    "chipmunk-next@#{version}-#{prefix}-portable"
  end
end
