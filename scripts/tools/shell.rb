# os detection
module Shell
    @@cmd = ""

    def self.suppress_output
        original_stdout, original_stderr = $stdout.clone, $stderr.clone
        $stderr.reopen File.new('/dev/null', 'w')
        $stdout.reopen File.new('/dev/null', 'w')
        yield
    ensure
        $stdout.reopen original_stdout
        $stderr.reopen original_stderr
    end

    def self.sh(cmd)
        if Shell.is_silence
            puts "[sh   ] #{Shell.cmd}> #{cmd}"
            Shell.suppress_output {
                Rake.sh(cmd) do |ok, status|
                    unless ok
                        fail "Failed with status (#{status.exitstatus})"
                    end
                end
            }
        else
            Rake.sh(cmd) do |ok, status|
                unless ok
                    fail "Failed with status (#{status.exitstatus})"
                end
            end
        end
    end

    def self.is_silence
        if ENV['CHIPMUNK_BUILD_SILENCE'] == 'true' || ENV['CHIPMUNK_BUILD_SILENCE'] == 'on' || ENV['CHIPMUNK_BUILD_SILENCE'] == '1'
            true
        else
            false
        end
    end

    def self.rm_rf(dir)
        if Shell.is_silence
            puts "[rm_rf] #{Shell.cmd}> #{dir}"
        end
        FileUtils.rm_rf(dir) if File.exist?(dir)
    end

    def self.rm(file)
        if Shell.is_silence
            puts "[rm   ] #{Shell.cmd}> #{file}"
        end
        FileUtils.rm(file) if File.exist?(file)
    end

    def self.chdir(dir, &block)
        @@cmd = "#{dir}"
        Dir.chdir(dir) do
            yield
        end
        @@cmd = ""
    end

    def self.cmd
        "\e[36m#{@@cmd}\e[0m"
    end

  end
  