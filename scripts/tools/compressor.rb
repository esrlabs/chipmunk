class Compressor
  def initialize(location, archname)
    @location = location
    @archname = archname
  end

  def compress
    target = if OS.mac?
               './chipmunk.app'
             else
               '*'
             end
    @archname += '.tgz'
    Dir.chdir(@location) do
      Rake.sh "tar -czf ../#{@archname} #{target}"
    end
    Reporter.add(Jobs::Release, Owner::Compressor, "compressed: #{@archname}", '')
  end
end
