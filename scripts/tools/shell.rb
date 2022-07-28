module Shell
  @@cmd = ''

  def self.suppress_output
    original_stdout = $stdout.clone
    original_stderr = $stderr.clone
    $stderr.reopen File.new('/dev/null', 'w')
    $stdout.reopen File.new('/dev/null', 'w')
    yield
  ensure
    $stdout.reopen original_stdout
    $stderr.reopen original_stderr
  end

  def self.sh(cmd)
    if Shell.is_verbose_hidden
      puts "[sh   ] #{Shell.cmd}> #{cmd}"
      Shell.suppress_output do
        Rake.sh(cmd) do |ok, status|
          raise "Failed with status (#{status.exitstatus})" unless ok
        end
      end
    else
      Rake.sh(cmd) do |ok, status|
        raise "Failed with status (#{status.exitstatus})" unless ok
      end
    end
  end

  def self.is_verbose_hidden
    ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == 'true' || ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == 'on' || ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == '1'
  end

  def self.rm_rf(dir)
    puts "[rm_rf] #{Shell.cmd}> #{dir}" if Shell.is_verbose_hidden
    FileUtils.rm_rf(dir) if File.exist?(dir)
  end

  def self.rm(file)
    puts "[rm   ] #{Shell.cmd}> #{file}" if Shell.is_verbose_hidden
    FileUtils.rm(file) if File.exist?(file)
  end

  def self.chdir(dir, &block)
    @@cmd = "#{dir}"
    Dir.chdir(dir, &block)
    @@cmd = ''
  end

  def self.cmd
    "\e[36m#{@@cmd}\e[0m"
  end
end
