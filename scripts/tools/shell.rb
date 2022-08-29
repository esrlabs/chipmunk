module Shell
  @@cwd = ''

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
    puts "[sh   ] #{Shell.cwd}> #{cmd}"
    if Shell.is_verbose_hidden
      Shell.suppress_output do
        raise "#{cmd}: failed with #{$?.exitstatus}" unless Kernel.system(cmd, exception: true)
      end
    elsif !Kernel.system(cmd, exception: true)
      raise "#{cmd}: failed with #{$?.exitstatus}"
    end
  end

  def self.is_verbose_hidden
    ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == 'true' || ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == 'on' || ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == '1'
  end

  def self.rm_rf(dir)
    puts "[rm_rf] #{Shell.cwd}> #{dir}" if Shell.is_verbose_hidden
    FileUtils.rm_rf(dir) if File.exist?(dir)
  end

  def self.rm(file)
    puts "[rm   ] #{Shell.cwd}> #{file}" if Shell.is_verbose_hidden
    FileUtils.rm(file) if File.exist?(file)
  end

  def self.chdir(dir, &block)
    @@cwd = "#{dir}"
    Dir.chdir(dir, &block)
    @@cwd = ''
  end

  def self.cwd
    "\e[36m#{@@cwd}\e[0m"
  end
end
