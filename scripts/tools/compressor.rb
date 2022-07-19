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
    if OS.mac? || OS.linux?
      @archname += '.tgz'
      Dir.chdir(@location) do
        Rake.sh "tar -czf ../#{@archname} #{target}"
      end
    else
      @archname += '.zip'
      Dir.chdir(@location) do
        Rake.sh "powershell -command \"Compress-Archive * ..\\#{@archname}\""
      end
    end
    Reporter.add(Jobs::Release, Owner::Compressor, "compressed: #{@archname}", '')
  end
end
