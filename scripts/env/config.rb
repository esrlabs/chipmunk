require 'json'

class Config
  def initialize
    file = File.read(Paths::CONFIG)
    @config = JSON.parse(file)
  end

  def get_rust_version
    @config['rust']
  end
end
