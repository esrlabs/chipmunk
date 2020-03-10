# frozen_string_literal: true

require 'json'

VERSIONS_FILE = './versions.json'
PACKAGE_JSON_FILE = './application/electron/dist/compiled/package.json'

class Versions
  def initialize
    raise "Fail to find file: #{VERSIONS_FILE}" unless File.file?(VERSIONS_FILE)

    @str = File.read(VERSIONS_FILE.to_s)
    @versions = JSON.parse(@str)
    puts "Next versions of frameworks/modules will be used:\n"
    puts "\telectron: #{@versions['electron']}\n"
    puts "\telectron-rebuild: #{@versions['electron-rebuild']}\n"
    puts "\tchipmunk.client.toolkit: #{@versions['chipmunk.client.toolkit']}\n"
    puts "\tchipmunk.plugin.ipc: #{@versions['chipmunk.plugin.ipc']}\n"
    puts "\tchipmunk-client-material: #{@versions['chipmunk-client-material']}\n"
    puts "\tangular-core: #{@versions['angular-core']}\n"
    puts "\tangular-material: #{@versions['angular-material']}\n"
    puts "\tforce: #{@versions['force']}\n"
  end

  def get
    @versions
  end
end

class PackageJson
  def initialize
    unless File.file?(PACKAGE_JSON_FILE)
      raise "Fail to find file: #{PACKAGE_JSON_FILE}"
    end

    @str = File.read(PACKAGE_JSON_FILE.to_s)
    @json = JSON.parse(@str)
    @versions = Versions.new
  end

  def delivery
    vers = @versions.get
    @json['chipmunk']['versions'] = {
      'electron' => vers['electron'],
      'electron-rebuild' => vers['electron-rebuild'],
      'chipmunk.client.toolkit' => vers['chipmunk.client.toolkit'],
      'chipmunk.plugin.ipc' => vers['chipmunk.plugin.ipc'],
      'chipmunk-client-material' => vers['chipmunk-client-material'],
      'angular-core' => vers['angular-core'],
      'angular-material' => vers['angular-material'],
      'force' => vers['force']
    }
    File.open(PACKAGE_JSON_FILE, 'w') do |f|
      f.write(@json.to_json)
    end
  end
end
