# frozen_string_literal: true
require './scripts/tools/shell'

# Create compressed archive of application
class Compressor
  def initialize(location, archname)
    @location = location
    @archname = archname
  end

  def compress
    target = if OS.mac?
               './chipmunk.app'
             else
               '* .release'
             end
    @archname += '.tgz'
    Shell.chdir(@location) do
      duration = Shell.timed_sh "tar -czf ../#{@archname} #{target}", "compress #{target}"
      Reporter.done('Compressor', "compressed: #{@archname}", '', duration)
    end
  end
end
