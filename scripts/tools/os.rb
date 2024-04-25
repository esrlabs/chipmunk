# frozen_string_literal: true

# os detection
module OS
  def self.windows?
    (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM) != nil
  end

  def self.mac?
    (/darwin/ =~ RUBY_PLATFORM) != nil
  end

  def self.unix?
    !OS.windows?
  end

  def self.linux?
    OS.unix? && !OS.mac?
  end

  def self.arm64?
    arch = (OS.unix? || OS.mac?) ? `uname -m` : `echo %PROCESSOR_ARCHITECTURE%`
    arch.chomp!.downcase!
    arch=='arm64' || arch=='aarch64'
  end

  def self.executable(filename)
    exe = if OS.windows?
            '.exe'
          else
            ''
          end
    "#{filename}#{exe}"
  end

  def self.prefix
    if OS.windows?
      'win'
    elsif OS.linux?
      'linux'
    else
      'darwin'
    end
  end
end
