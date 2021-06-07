# frozen_string_literal: true

require 'rake'
CLI_EXE_NAME = 'indexer_cli'
EXE_NAME = 'chip'
HOME = ENV['HOME']

LEVEL_WARN = 1
LEVEL_INFO = 2
LEVEL_DEBUG = 3
LEVEL_TRACE = 4
VERBOSITY = LEVEL_DEBUG

def debug(content)
  puts("DEBUG: #{content}") unless VERBOSITY < LEVEL_DEBUG
end

def green(content)
  begin
    require 'colored'
    content.green.to_s
  rescue LoadError
    content
  end
end
def yellow(content)
  begin
    require 'colored'
    content.yellow.to_s
  rescue LoadError
    content
  end
end

def info(content)
  puts("#{green('INFO')}: #{content}") unless VERBOSITY < LEVEL_INFO
end

def warn(content)
  require 'colored'
  puts("#{yellow('WARN')}: #{content}") unless VERBOSITY < LEVEL_WARN
end

def sh_cmds(commands)
  sh commands.join(' && ')
end

# distinguish between OS
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

  def self.jruby?
    RUBY_ENGINE == 'jruby'
  end
end
desc 'run tests'
task :test do
  sh 'cargo test'
end

desc 'Format code with nightly cargo fmt'
task :format do
  sh 'cargo +nightly fmt'
end
desc 'Check'
task :check do
  sh 'cargo +nightly fmt -- --color=always --check'
  sh 'cargo clippy'
  sh 'cargo test'
end

namespace :bench do
  desc 'run parse benchmarks'
  task :parse do
    sh 'cargo bench --bench parse_benchmarks'
  end
  desc 'run parse benchmarks, compare to baseline'
  task :parse_master do
    sh 'cargo bench --bench parse_benchmarks -- --baseline master'
  end
  desc 'record new parse baseline'
  task :parse_baseline do
    sh 'cargo bench --bench parse_benchmarks -- --save-baseline master'
  end
end
desc 'run tests with printing to stdout'
task :test_nocapture do
  sh 'cargo test -q -- --nocapture'
end
def create_changelog(current_version, next_version)
  raw_log = `git log --format=%B #{current_version}..HEAD`.strip
  log_lines = raw_log.split(/\n/)
  log = log_lines
        .reject { |x| x.strip == '' }
        .collect { |line| "  * #{line}" }.join("\n")

  date = Time.now.strftime('%m/%d/%Y')
  log_entry = "### [#{next_version}] - #{date}\n#{log}"
  puts "logmessages: #{log}"
  ['README.md'].each do |file|
    text = File.read(file)
    new_contents = text.gsub(/^#\sChangelog/, "# Changelog\n\n#{log_entry}")
    File.open(file, 'w') { |f| f.puts new_contents }
  end
end

def build_debug
  sh 'cargo build'
  current_version = read_current_version
  debug_folder = 'target/debug'
  os_ext = 'darwin'
  cd debug_folder.to_s, verbose: false do
    cp CLI_EXE_NAME.to_s, EXE_NAME.to_s
    cp EXE_NAME.to_s, "#{HOME}/bin/#{EXE_NAME}"
    sh "tar -cvzf indexing@#{current_version}-#{os_ext}.tgz #{EXE_NAME}"
  end
end
def build_the_release
  sh 'cargo build --release'
  current_version = read_current_version
  release_folder = 'target/release'
  os_ext = 'darwin'
  if OS.linux?
    os_ext = 'linux'
  elsif OS.windows?
    os_ext = 'windows'
    release_folder = 'target/x86_64-pc-windows-gnu/release'
  end
  cd release_folder.to_s, verbose: false do
    cp CLI_EXE_NAME.to_s, EXE_NAME.to_s
    cp EXE_NAME.to_s, "#{HOME}/bin/#{EXE_NAME}"
    sh "tar -cvzf indexing@#{current_version}-#{os_ext}.tgz #{EXE_NAME}"
  end
end

def build_the_release_windows
  sh 'cargo build --release --target=x86_64-pc-windows-gnu'
  current_version = read_current_version
  release_folder = 'target/x86_64-pc-windows-gnu/release'
  tgz_file = "indexing@#{current_version}-win64.tgz"
  cd release_folder.to_s, verbose: false do
    cp "#{CLI_EXE_NAME}.exe", "#{EXE_NAME}.exe"
    sh "tar -cvzf #{tgz_file} #{EXE_NAME}.exe"
  end
  mv "#{release_folder}/#{tgz_file}", 'target/release'
end

def build_the_release_windows32
  sh 'cargo build --release --target=i686-pc-windows-gnu'
  current_version = read_current_version
  release_folder = 'target/i686-pc-windows-gnu/release'
  tgz_file = "indexing@#{current_version}-win32.tgz"
  cd release_folder.to_s, verbose: false do
    cp "#{CLI_EXE_NAME}.exe", "#{EXE_NAME}.exe"
    sh "tar -cvzf #{tgz_file} #{EXE_NAME}.exe"
  end
  mv "#{release_folder}/#{tgz_file}", 'target/release'
end
desc 'create new version and release'
task :create_release do
  current_tag = `git describe --tags`
  current_toml_version = read_current_version
  unless current_tag.start_with?(current_toml_version)
    warn "current tag #{current_tag} does not match toml version: #{current_toml_version}"
  end

  require 'highline'
  cli = HighLine.new
  cli.choose do |menu|
    default = :minor
    menu.prompt = "this will create and tag a new version (default: #{default}) "
    menu.choice(:minor) do
      next_version = get_next_version(:minor)
      debug "create minor version with version #{next_version}"
      create_new_version(next_version)
      build_the_release
    end
    menu.choice(:major) do
      next_version = get_next_version(:major)
      debug "create major version with version #{next_version}"
      create_new_version(next_version)
      build_the_release
    end
    menu.choice(:patch) do
      next_version = get_next_version(:patch)
      debug "create patch version with version #{next_version}"
      create_new_version(next_version)
      build_the_release
    end
    menu.choice(:abort) { cli.say('ok...maybe later') }
    menu.default = default
  end
end

desc 'build debug, no version bump'
task :build_debug do
  build_debug
end
desc 'build release, no version bump'
task :build_release do
  build_the_release
  if OS.linux?
    build_the_release_windows
    build_the_release_windows32
  end
end

namespace :version do
  desc 'bump patch level'
  task :patch do
    next_version = get_next_version(:patch)
    debug "next_version=#{next_version}"
    create_new_version(next_version)
  end
  desc 'bump minor level'
  task :minor do
    next_version = get_next_version(:minor)
    debug "next_version=#{next_version}"
    create_new_version(next_version)
  end
  desc 'bump major level'
  task :major do
    next_version = get_next_version(:major)
    debug "next_version=#{next_version}"
    create_new_version(next_version)
  end
end

def get_next_version(jump)
  current_version = read_current_version
  v = Version.new(current_version)
  v.send(jump)
end

def read_current_version
  current_version = nil
  cd CLI_EXE_NAME, verbose: false do
    ['Cargo.toml'].each do |file|
      text = File.read(file)
      match = text.match(/^version\s=\s\"(.*)\"/i)
      current_version = match.captures[0] if match
    end
  end
  current_version
end

def update_toml(new_version)
  cd CLI_EXE_NAME, verbose: false do
    ['Cargo.toml'].each do |file|
      text = File.read(file)
      new_contents = text.gsub(/^version\s=\s\"\d+\.\d+\.\d+\"/, "version = \"#{new_version}\"")
      File.open(file, 'w') { |f| f.puts new_contents }
    end
  end
end

def create_new_version(next_version)
  sh 'cargo test -q'
  update_toml(next_version)
  sh 'cargo build'
end

class Version < Array
  def initialize(s)
    super(s.split('.').map(&:to_i))
  end

  def as_version_code
    get_major * 1000 * 1000 + get_minor * 1000 + get_patch
  end

  def <(x)
    (self <=> x) < 0
  end

  def >(x)
    (self <=> x) > 0
  end

  def ==(x)
    (self <=> x) == 0
  end

  def patch
    patch = last
    self[0...-1].concat([patch + 1])
  end

  def minor
    self[1] = self[1] + 1
    self[2] = 0
    self
  end

  def major
    self[0] = self[0] + 1
    self[1] = 0
    self[2] = 0
    self
  end

  def get_major
    self[0]
  end

  def get_minor
    self[1]
  end

  def get_patch
    self[2]
  end

  def to_s
    join('.')
  end
end

