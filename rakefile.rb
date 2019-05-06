require 'rake'
EXE_NAME="logviewer_parser"
HOME=ENV['HOME']

task :default => [:test]
desc "run tests"
task :test do
  sh "cargo test -- --nocapture"
end
desc "push tag to github"
task :push do
  sh "git push origin"
  current_version = get_current_version
  sh "git push origin #{current_version}"
end

def build_the_release
  sh "cargo build --release"
  current_version = get_current_version
  cd "target/release" do
    cp "#{EXE_NAME}","#{HOME}/bin/#{EXE_NAME}"
    sh "tar -cvzf indexing@#{current_version}-darwin.tgz #{EXE_NAME}"
  end
end
desc "create new version and release"
task :create_release do
  require 'highline'
  cli = HighLine.new
  cli.choose do |menu|
    default = :minor
    menu.prompt = "this will create and tag a new version (default: #{default}) "
    menu.choice(:minor) do
      next_version = get_next_version(:minor)
      puts "create minor version with version #{next_version}"
      create_and_tag_new_version(next_version)
      build_the_release()
    end
    menu.choice(:major) do
      next_version = get_next_version(:major)
      puts "create major version with version #{next_version}"
      create_and_tag_new_version(next_version)
      build_the_release()
    end
    menu.choice(:patch) do
      next_version = get_next_version(:patch)
      puts "create patch version with version #{next_version}"
      create_and_tag_new_version(next_version)
      build_the_release()
    end
    menu.choice(:abort) { cli.say("ok...maybe later") }
    menu.default = default
  end
end

desc "build release, no version bump"
task :build_release do
  build_the_release
end

namespace :version do
  desc 'bump patch level'
  task :patch do
    next_version = get_next_version(:patch)
    puts "next_version=#{next_version}"
    create_and_tag_new_version(next_version)
  end
  desc 'bump minor level'
  task :minor do
    next_version = get_next_version(:minor)
    puts "next_version=#{next_version}"
    create_and_tag_new_version(next_version)
  end
  desc 'bump major level'
  task :major do
    next_version = get_next_version(:major)
    puts "next_version=#{next_version}"
    create_and_tag_new_version(next_version)
  end
end

def get_next_version(jump)
  current_version = get_current_version
  v = Version.new(current_version)
  v.send(jump)
end

def get_current_version
  current_version = nil
  ['Cargo.toml'].each do |file|
    text = File.read(file)
    if match = text.match(/^version\s=\s\"(.*)\"/i)
      current_version = match.captures[0]
      puts "version was: #{current_version}"
    end
  end
  current_version
end
def update_toml(new_version)
  ['Cargo.toml'].each do |file|
    text = File.read(file)
    new_contents = text.gsub(/^version\s=\s\"\d+\.\d+\.\d+\"/, "version = \"#{new_version}\"")
    File.open(file, "w") { |f| f.puts new_contents }
  end
end

def create_and_tag_new_version(next_version)
  current_version = get_current_version
  update_toml(next_version)
  sh "cargo build"
  sh "git add ."
  sh "git commit -m \"[](chore): version bump from #{current_version} => #{next_version.to_s}\""
  sh "git tag #{next_version.to_s}"
  puts "to undo the last commit and the tag, execute:"
  puts "git reset --hard HEAD~1 && git tag -d #{next_version.to_s}"
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
