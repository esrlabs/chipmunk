# frozen_string_literal: true

require 'rake'
CLI_EXE_NAME = 'indexer_cli'

LEVEL_WARN = 1
LEVEL_INFO = 2
LEVEL_DEBUG = 3
LEVEL_TRACE = 4
VERBOSITY = LEVEL_DEBUG

def debug(content)
  puts("DEBUG: #{content}") unless VERBOSITY < LEVEL_DEBUG
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
      match = text.match(/^version\s=\s"(.*)"/i)
      current_version = match.captures[0] if match
    end
  end
  current_version
end

def update_toml(new_version)
  cd CLI_EXE_NAME, verbose: false do
    ['Cargo.toml'].each do |file|
      text = File.read(file)
      new_contents = text.gsub(/^version\s=\s"\d+\.\d+\.\d+"/, "version = \"#{new_version}\"")
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

  def <(other)
    (self <=> other).negative?
  end

  def >(other)
    (self <=> other).positive?
  end

  def ==(other)
    (self <=> other).zero?
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
