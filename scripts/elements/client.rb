class Client
  def initialize(reinstall, prod)
    @dist = "#{Paths::CLIENT}/dist"
    @node_modules = "#{Paths::CLIENT}/node_modules"
    @reinstall = reinstall
    @prod = prod
    @installed = File.exist?(@node_modules)
    @targets = [@dist, @node_modules]
    @changes_to_files = ChangeChecker.has_changes?(Paths::CLIENT, @targets)
  end

  def set_changes_to_files(val)
    @changes_to_files = val
  end

  def install
    Shell.rm_rf(@node_modules) if @reinstall
    if !@installed || @reinstall
      Shell.chdir(Paths::CLIENT) do
        Shell.sh 'yarn install'
        Reporter.done(self, 'installing', '')
      end
    else
      Reporter.skipped(self, 'installing', '')
    end
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
    install
    if @prod
      matcher = Matcher.new(true, true)
      ansi = Ansi.new(true, true)
      utils = Utils.new(true, true)
      client_build_needed = @changes_to_files || matcher.changes_to_files || ansi.changes_to_files || utils.changes_to_files
      matcher.build
      ansi.build
      utils.build
      if client_build_needed
        begin
          Shell.chdir(Paths::CLIENT) do
            Shell.sh 'yarn run prod'
            Reporter.done(self, 'build in production mode', '')
          end
        rescue
          Reporter.failed(self, 'build in production mode', '')
          @changes_to_files = true
          clean
          build
        end
      else
        Reporter.skipped(self, 'build in production mode', '')
      end
    else
      matcher = Matcher.new(false, false)
      ansi = Ansi.new(false, false)
      utils = Utils.new(false, false)
      client_build_needed = @changes_to_files || matcher.changes_to_files || ansi.changes_to_files || utils.changes_to_files
      matcher.build
      ansi.build
      utils.build
      if client_build_needed
        begin
          Shell.chdir(Paths::CLIENT) do
            Shell.sh 'yarn run build'
            Reporter.done(self, 'build in developing mode', '')
          end
        rescue
          Reporter.failed(self, 'build in developing mode', '')
          @changes_to_files = true
          clean
          build
        end
      else
        Reporter.skipped(self, 'build in developing mode', '')
      end
    end
  end

  def self.delivery(dest, prod, replace)
    if !replace && File.exist?("#{Paths::CLIENT}/dist/client")
      Reporter.skipped('Client', 'client already exist', '')
      return
    end
    Dir.mkdir(dest) unless File.exist?(dest)
    client = Client.new(false, prod)
    client.build
    Shell.sh "cp -r #{Paths::CLIENT}/dist/client #{dest}"
    Reporter.done('Client', "delivery to #{dest}", '')
  end

  def lint
    install
    Shell.chdir(Paths::CLIENT) do
      Shell.sh 'yarn run lint'
      Reporter.done(self, 'linting', '')
    end
  end
end