require 'benchmark'
require 'fileutils'

module OS
  def OS.windows?
    (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM) != nil
  end

  def OS.mac?
   (/darwin/ =~ RUBY_PLATFORM) != nil
  end

  def OS.unix?
    !OS.windows?
  end

  def OS.linux?
    OS.unix? and not OS.mac?
  end

  def OS.jruby?
    RUBY_ENGINE == 'jruby'
  end
end

$task_benchmarks = []

class Rake::Task
  def execute_with_benchmark(*args)
    bm = Benchmark.realtime { execute_without_benchmark(*args) }
    $task_benchmarks << [name, bm]
  end

  alias_method :execute_without_benchmark, :execute
  alias_method :execute, :execute_with_benchmark
end

at_exit do
  total_time = $task_benchmarks.reduce(0) {|acc, x| acc + x[1]}
  $task_benchmarks
    .sort { |a, b| b[1] <=> a[1] }
    .each do |res|
    percentage = res[1]/total_time * 100
    if percentage.round > 0
      percentage_bar = ""
      percentage.round.times { percentage_bar += "|" }
      puts "#{percentage_bar} (#{'%.1f' % percentage} %) #{res[0]} ==> #{'%.1f' % res[1]}s"
    end
  end
  puts "total time was: #{'%.1f' % total_time}"
end
class Versioner
  def self.for(type, version_dir)
    case type
    when :package_json
      JsonVersioner.new(version_dir)
    when :cargo_toml
      TomlVersioner.new(version_dir)
    end
  end
end

class TomlVersioner
  def initialize(version_dir)
    @version_dir = version_dir
  end
  def get_next_version(jump)
    current_version = get_current_version()
    v = Version.new(current_version)
    v.send(jump)
  end
  def get_current_version()
    current_version = nil
    FileUtils.cd @version_dir, :verbose => false do
      ['Cargo.toml'].each do |file|
        text = File.read(file)
        if match = text.match(/^version\s=\s\"(.*)\"/i)
          current_version = match.captures[0]
        end
      end
    end
    current_version
  end
  def increment_version(jump)
    next_version = get_next_version(jump)
    puts "increment version from #{get_current_version} ==> #{next_version}"
    update_version(next_version)
  end
  def update_version(new_version)
    FileUtils.cd @version_dir, :verbose => false do
      ['Cargo.toml'].each do |file|
        text = File.read(file)
        new_contents = text.gsub(/^version\s=\s\"\d+\.\d+\.\d+\"/, "version = \"#{new_version}\"")
        File.open(file, "w") { |f| f.puts new_contents }
      end
    end
  end
end
class JsonVersioner
  def initialize(version_dir)
    @version_dir = version_dir
  end
  def get_next_version(jump)
    current_version = get_current_version()
    v = Version.new(current_version)
    v.send(jump)
  end
  def get_current_version()
    current_version = nil
    FileUtils.cd @version_dir, :verbose => false do
      ['package.json'].each do |file|
        text = File.read(file)
        if match = text.match(/^\s\s\"version\":\s\"(.*)\"/i)
          current_version = match.captures[0]
        end
      end
    end
    current_version
  end
  def increment_version(jump)
    next_version = get_next_version(jump)
    puts "increment version from #{get_current_version} ==> #{next_version}"
    update_version(next_version)
  end
  def update_version(new_version)
    FileUtils.cd @version_dir, :verbose => false do
      ['package.json'].each do |file|
        text = File.read(file)
        new_contents = text.gsub(/^\s\s\"version\":\s\"\d+\.\d+\.\d+\"/, "  \"version\": \"#{new_version}\"")
        File.open(file, "w") { |f| f.puts new_contents }
      end
    end
  end
end

class Version < Array
  def initialize s
    super(s.split('.').map { |e| e.to_i })
  end
  def as_version_code
    get_major*1000*1000 + get_minor*1000 + get_patch
  end
  def < x
    (self <=> x) < 0
  end
  def > x
    (self <=> x) > 0
  end
  def == x
    (self <=> x) == 0
  end
  def patch
    patch = self.last
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
    self.join(".")
  end
end

## git related utilities

desc "push tag to github"
task :push do
  sh "git push origin"
  current_version = get_current_version
  sh "git push origin #{current_version}"
end
def create_changelog(current_version, next_version)
  sha1s = `git log #{current_version}..HEAD --oneline`.strip.split(/\n/).collect { |line| line.split(' ').first }
  log_entries = []
  sha1s.each do |sha1|
    raw_log = `git log --format=%B -n 1 #{sha1}`.strip
    log_lines = raw_log.split(/\n/)
    first_line = true
    entry = log_lines
        .reject{|x| x.strip == ""}
        .collect do |line|
          if line =~ /^\s*\*/
            "#{line.sub(/\s*\*/, "  *")}"
          else
            res = first_line ? "* #{line}" : "  #{line}"
            first_line = false
            res
          end
        end
    log_entries << entry
  end
  log = log_entries.join("\n")

  date = Time.now.strftime("%m/%d/%Y")
  log_entry = "### [#{next_version}] - #{date}\n#{log}"
  puts "logmessages:\n#{log}"
  ['CHANGELOG.md'].each do |file|
    if !File.exist?(file)
      File.open(file, 'w') {|f| f.write("# Changelog") }
    end
    text = File.read(file)
    new_contents = text.gsub(/^#\sChangelog/, "# Changelog\n\n#{log_entry}")
    File.open(file, "w") { |f| f.puts new_contents }
  end
end
