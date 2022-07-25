# frozen_string_literal: true

require 'rake/clean'
require 'fileutils'

TEST_FOLDER = 'update_test'

CLEAN.include([TEST_FOLDER, 'backup_*.gz'])

def optional_exe(path)
  if OS.windows?
    "#{path}.exe"
  else
    path
  end
end

def create_update_package(input, kind)
  update_dir = "#{TEST_FOLDER}/update_package"
  update_path = if OS.mac?
                  "#{update_dir}/chipmunk.app/Contents/MacOS"
                else
                  update_dir
                end
  mkdir_p update_path
  cp input, "#{update_path}/#{optional_exe('chipmunk')}"
  cd update_dir do
    if kind == :ok
      if OS.mac?
        sh 'tar cfvz update.tar.gz chipmunk.app'
      else
        sh "tar cfvz update.tar.gz #{optional_exe('chipmunk')}"
      end
    elsif kind == :rollback
      sh 'touch update.tar.gz'
    end
    mv 'update.tar.gz', '..'
  end
end

def build_old_and_new_version(old_dir, kind)
  # build "old" version
  sh 'cargo build --bin miniapp'
  current_version = `./target/debug/#{optional_exe('miniapp')}`
  puts "mv old up in place: #{old_dir}/#{optional_exe('chipmunk')}"
  mv "target/debug/#{optional_exe('miniapp')}", "#{old_dir}/#{optional_exe('chipmunk')}"

  # build "new" version
  versioner = Versioner.for(:cargo_toml, 'miniapp')
  versioner.increment_version(:minor)

  main = 'miniapp/src/main.rs'
  content = File.read(main)
  new_content = content.gsub('0.1.0', '0.2.0')
  File.open(main, 'w') { |file| file.puts new_content }

  sh 'cargo build --bin miniapp'
  create_update_package("target/debug/#{optional_exe('miniapp')}", kind)
  current_version
end

def test_the_update(kind)
  sh 'cargo build --bin updater'
  rm_rf TEST_FOLDER
  old_app_folder = "#{TEST_FOLDER}/miniapp_01"
  old_dir = if OS.mac?
              "#{old_app_folder}/chipmunk.app/Contents/MacOS"
            else
              old_app_folder.to_s
            end
  mkdir_p old_dir
  cp 'miniapp/Cargo.toml', TEST_FOLDER
  cp 'miniapp/src/main.rs', TEST_FOLDER
  cp 'Cargo.lock', TEST_FOLDER
  current_version = build_old_and_new_version(old_dir, kind)

  # execute update
  sh 'cargo build --bin updater'
  old_exe = if OS.mac?
              "#{old_app_folder}/chipmunk.app"
            elsif OS.windows?
              "#{old_app_folder}/chipmunk.exe"
            else
              "#{old_app_folder}/chipmunk"
            end
  updater_exe = "./target/debug/#{optional_exe('updater')}"
  puts "using updater: #{updater_exe}"
  raise 'app does not exist' unless File.exist?(old_exe)

  puts "try to update this executable: #{old_exe}"
  next_version = `#{updater_exe} #{old_exe} update_test/update.tar.gz`
  current_v = Version.new(current_version)
  next_v = Version.new(next_version)

  puts "current version was: #{current_v}"
  puts "next version was: #{next_v}"
  if kind == :rollback
    raise 'rollback failed' unless next_v == current_v
  else
    incremented = current_v.minor
    puts "incremented = #{incremented}"
    raise 'update failed' unless next_v == incremented
  end
ensure
  # clean up
  cp "#{TEST_FOLDER}/Cargo.toml", 'miniapp'
  cp "#{TEST_FOLDER}/main.rs", 'miniapp/src'
  cp "#{TEST_FOLDER}/Cargo.lock", '.'
  rm_rf TEST_FOLDER
  Dir.glob('backup_*.tar.gz').each do |f|
    rm_rf f
  end
end


desc 'test updater for miniapp'
task :test_updater do
  test_the_update(:ok)
end

desc 'test updater for miniapp with rollback'
task :test_updater_flawed_tgz do
  test_the_update(:rollback)
end

desc 'test updater with and without rollback'
task :test => [:test_updater, :test_updater_flawed_tgz]

task :default => :test

# os detection
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

# version managementl
class Versioner
  def self.for(type, version_dir)
    case type
    when :gemspec
      GemspecVersioner.new(version_dir)
    when :package_json
      JsonVersioner.new(version_dir)
    when :cargo_toml
      TomlVersioner.new(version_dir)
    end
  end
end

def current_version_with_regex(filelist, r)
  current_version = nil
  FileUtils.cd @version_dir, :verbose => false do
    filelist.each do |file|
      text = File.read(file)
      if match = text.match(r)
        current_version = match.captures[1]
      end
    end
  end
  current_version
end

class Versioner
  def initialize(version_dir)
    @version_dir = version_dir
  end

  def get_next_version(jump)
    current_version = get_current_version
    v = Version.new(current_version)
    v.send(jump)
  end

  def increment_version(jump)
    next_version = get_next_version(jump)
    puts "increment version from #{get_current_version} ==> #{next_version}"
    update_version(next_version)
  end
end

class TomlVersioner < Versioner
  VERSION_REGEX = /^(version\s=\s['\"])(\d+\.\d+\.\d+)(['\"])/i.freeze
  def get_current_version
    current_version_with_regex(['Cargo.toml'], VERSION_REGEX)
  end

  def update_version(new_version)
    FileUtils.cd @version_dir, :verbose => false do
      ['Cargo.toml'].each do |file|
        text = File.read(file)
        new_contents = text.gsub(VERSION_REGEX, "\\1#{new_version}\\3")
        File.open(file, 'w') { |f| f.puts new_contents }
      end
    end
  end
end

class GemspecVersioner < Versioner
  VERSION_REGEX = /^(\s*.*?\.version\s*?=\s*['\"])(.*)(['\"])/i.freeze
  DATE_REGEX = /^(\s*.*?\.date\s*?=\s*['\"])(.*)(['\"])/.freeze
  def get_current_version
    current_version_with_regex(FileList['*.gemspec'], VERSION_REGEX)
  end

  def update_version(new_version)
    FileUtils.cd @version_dir, :verbose => false do
      FileList['*.gemspec'].each do |file|
        text = File.read(file)
        today = Time.now.strftime('%Y-%m-%d')
        correct_date_contents = text.gsub(DATE_REGEX, "\\1#{today}\\3")
        new_contents = correct_date_contents.gsub(VERSION_REGEX, "\\1#{new_version}\\3")
        File.open(file, 'w') { |f| f.write new_contents }
      end
    end
  end
end

class JsonVersioner < Versioner
  VERSION_REGEX = /^(\s+['\"]version['\"]:\s['\"])(.*)(['\"])/i.freeze
  def get_current_version
    current_version_with_regex(['package.json'], VERSION_REGEX)
  end

  def update_version(new_version)
    FileUtils.cd @version_dir, :verbose => false do
      ['package.json'].each do |file|
        text = File.read(file)
        new_contents = text.gsub(VERSION_REGEX, "\\1#{new_version}\\3")
        File.open(file, 'w') { |f| f.puts new_contents }
      end
    end
  end
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
