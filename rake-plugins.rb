# frozen_string_literal: true

require 'octokit'
require 'open-uri'

REPO = 'esrlabs/chipmunk-plugins-store'
RELEASES_FILE_NAME = 'releases'
REGISTERS = [
  'releases-darwin.json',
  'releases-linux.json',
  'releases-win32.json'
]
def get_nodejs_platform
  if OS.windows?
    'win32'
  elsif OS.mac?
    'darwin'
  else
    'linux'
  end
end

class Github
  def initialize
    if !ENV['GITHUB_LOGIN'].nil? && !ENV['GITHUB_PASW'].nil? &&
       ENV['GITHUB_LOGIN'] != '' && ENV['GITHUB_PASW'] != ''
      puts 'Login to Github using login/password'
      @client = Octokit::Client.new(login: ENV['GITHUB_LOGIN'], password: ENV['GITHUB_PASW'])
    else
      puts 'Login to Github using token'
      @client = Octokit::Client.new(access_token: ENV['GITHUB_TOKEN'])
    end
  end

  def get_releases_list
    puts 'Getting latest release'
    release = @client.latest_release(REPO, {})
    puts 'Getting assets latest release'
    assets = @client.release_assets(release.url, {})
    release_file_asset = nil
    @registers = {};
    assets.each do |a|
      release_file_asset = a if a.name == self.class.get_name
      if REGISTERS.include?(a.name)
        @registers[a.name] = a
      end
    end
    if release_file_asset.nil?
      raise "Fail to find latest release file on repo #{REPO}"
    end

    puts "Reading releases file from \"#{release_file_asset.browser_download_url}\""
    release_file_asset_contents = open(release_file_asset.browser_download_url, &:read)
    releases = JSON.parse(release_file_asset_contents)
    releases
  end

  def get_release_registers
    @registers
  end

  def self.get_name
    "#{RELEASES_FILE_NAME}-#{get_nodejs_platform}.json"
  end

end

class DefaultsPlugins

  def initialize
    @github = Github.new
    @releases = @github.get_releases_list
    @registers = @github.get_release_registers
    @defaults = []
    @releases.each do |p|
      if p['default']
        @defaults.push(p)
        puts "Plugin \"#{p['name']}\" will be included into package"
      end
    end
  end

  def delivery(dest)
    @defaults.each do |p|
      puts "Downloading \"#{p['name']}\" from \"#{p['url']}\""
      File.write "#{dest}/#{p['file']}", open(p['url']).read
    end
  end

  def delivery_registry(dest)
    @registers.each do |file_name, r|
      puts "Downloading \"#{r['name']}\" from \"#{r['browser_download_url']}\""
      File.write "#{dest}/#{file_name}", open(r['browser_download_url']).read
    end
  end
  

end
