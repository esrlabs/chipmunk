# frozen_string_literal: true

require 'English'
module Shell
  @@cwd = ''
  @times = {}

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

  def self.timed_sh(cmd, desc)
    desc = cmd if desc.nil?
    timed_operation(-> { sh cmd }, desc)
  end

  def self.cp_r(src, dest, desc = nil)
    cmd = "cp_r(#{src}, #{dest})"
    desc = cmd if desc.nil?
    timed_operation(-> { FileUtils.cp_r src, dest }, desc)
  end

  def self.timed_operation(cmd, tag)
    starting = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    cmd.call
    ending = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    elapsed = ending - starting
    current = @times[tag] || 0
    new_elapsed = current + elapsed
    @times[tag] = new_elapsed
    elapsed
  end

  def self.report
    @times.each { |key, value| puts "#{key} took #{value.round(1)}s" }
  end

  def self.sh(cmd)
    puts "[sh   ] #{Shell.cwd}> #{cmd}"
    if Shell.is_verbose_hidden
      Shell.suppress_output do
        raise "#{cmd}: failed with #{$CHILD_STATUS.exitstatus}" unless Kernel.system(cmd, exception: true)
      end
    elsif !Kernel.system(cmd, exception: true)
      raise "#{cmd}: failed with #{$CHILD_STATUS.exitstatus}"
    end
  end

  def self.is_verbose_hidden
    ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == 'true' || ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == 'on' || ENV['CHIPMUNK_BUILD_VERBOSE_HIDE'] == '1'
  end

  def self.rm_rf(dir)
    puts "[rm_rf] #{Shell.cwd}> #{dir}" if Shell.is_verbose_hidden
    FileUtils.rm_rf(dir)
  end

  def self.rm(file)
    puts "[rm   ] #{Shell.cwd}> #{file}" if Shell.is_verbose_hidden
    FileUtils.rm_f(file)
  end

  def self.chdir(dir, &block)
    @@cwd = dir.to_s
    Dir.chdir(dir, &block)
    @@cwd = ''
  end

  def self.cwd
    "\e[36m#{@@cwd}\e[0m"
  end
end