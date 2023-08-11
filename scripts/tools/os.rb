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
