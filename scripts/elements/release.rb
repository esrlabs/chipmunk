require 'dotenv/load'

class Release
  def initialize(prod, compress)
    @prod = prod
    @compress = compress
  end

  def clean
    if File.exist?(Paths::RELEASE)
      Shell.rm_rf(Paths::RELEASE)
      Reporter.removed(self, "removed: #{Paths::RELEASE}", '')
    else
      Reporter.other(self, "doesn't exist: #{Paths::RELEASE}", '')
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
      Reporter.done(self, "built", '')
    end
    snapshot
    Reporter.done(self, "done: #{Paths::RELEASE_BUILD}", '')
    if @compress
      Compressor.new(Paths::RELEASE_BUILD, release_file_name).compress
    else
      Reporter.skipped(self, 'compressing is skipped', '')
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
      Reporter.skipped(self, "build for darwin doesn't require snapshot", '')
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
    Reporter.done(self, 'files snapshot has been created', '')
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
