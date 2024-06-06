# frozen_string_literal: true

module Platform
  DIST = "#{Paths::PLATFORM}/dist"
  NODE_MODULES = "#{Paths::PLATFORM}/node_modules"
  TARGETS = [DIST, NODE_MODULES].freeze
end

def check_if_files_are_updated(path_in_platform)
  require 'digest'
  require 'find'
  path_to_check = "#{Paths::PLATFORM}/#{path_in_platform}"
  reference_checksum = Digest::MD5.file(path_to_check).hexdigest
  root_p = Pathname.new(Paths::ROOT)
  puts "compare with reference : #{Pathname.new(path_to_check).relative_path_from(root_p)}"
  Find.find("#{Paths::ROOT}/application") do |path|
    if path =~ /request\/file\/checksum.ts/
      p = Pathname.new(path)
      p_rel = p.relative_path_from(root_p)
      checksum = Digest::MD5.file(path).hexdigest
      puts "path: #{p_rel}: #{checksum == reference_checksum ? 'OK' : 'OUT OF SYNC!'}"
    end
  end
end

namespace :platform do
  desc 'check if copied files are synced'
  task :check_sync do
    require 'digest'
    require 'find'
    path_to_check = "#{Paths::PLATFORM}/ipc/request/file/checksum.ts"
    reference_checksum = Digest::MD5.file(path_to_check).hexdigest
    root_p = Pathname.new(Paths::ROOT)
    puts "compare with reference : #{Pathname.new(path_to_check).relative_path_from(root_p)}"
    Find.find("#{Paths::ROOT}/application") do |path|
      if path =~ /request\/file\/checksum.ts/
        p = Pathname.new(path)
        p_rel = p.relative_path_from(root_p)
        checksum = Digest::MD5.file(path).hexdigest
        puts "path: #{p_rel}: #{checksum == reference_checksum ? 'OK' : 'OUT OF SYNC!'}"
      end
    end

    path_to_check = "#{Paths::ROOT}/application/platform/modules/system.ts"
    reference_checksum = Digest::MD5.file(path_to_check).hexdigest
    puts "compare with reference : #{Pathname.new(path_to_check).relative_path_from(root_p)}"
    Find.find("#{Paths::ROOT}") do |path|
      if path =~ /platform\/modules\/system.ts/
        p = Pathname.new(path)
        p_rel = p.relative_path_from(root_p)
        checksum = Digest::MD5.file(path).hexdigest
        puts "path: #{p_rel}: #{checksum == reference_checksum ? 'OK' : 'OUT OF SYNC!'}"
      end
    end

    path_to_check = "#{Paths::ROOT}/application/platform/dist/modules/system.js"
    reference_checksum = Digest::MD5.file(path_to_check).hexdigest
    puts "compare with reference : #{Pathname.new(path_to_check).relative_path_from(root_p)}"
    Find.find("#{Paths::ROOT}") do |path|
      if path =~ /dist\.*\/system.js/
        p = Pathname.new(path)
        p_rel = p.relative_path_from(root_p)
        checksum = Digest::MD5.file(path).hexdigest
        puts "path: #{p_rel}: #{checksum == reference_checksum ? 'OK' : 'OUT OF SYNC!'}"
      end
    end
  end

  task :clean do
    Platform::TARGETS.each do |path|
      path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
      if File.exist?(path)
        Shell.rm_rf(path)
        Reporter.removed('platform', "removed: #{File.basename(path)}", '')
      end
    end
  end

  task :wipe_installation do
    Shell.rm_rf(Platform::NODE_MODULES)
  end

  task reinstall: ['platform:wipe_installation', 'platform:install']

  task :install do
    Shell.chdir(Paths::PLATFORM) do
      Reporter.log 'Installing platform libraries'
      duration = Shell.timed_sh("yarn install", 'yarn install platform')
      Reporter.done('platform', 'installing', '', duration)
    end
  end

  task rebuild: ['platform:clean', 'platform:build']

  desc 'build platform'
  task build: ['platform:install', 'environment:check'] do
    Shell.rm_rf(Platform::DIST) if @rebuild
    Reporter.removed('platform', File.basename(Platform::DIST), '')
    begin
      Shell.chdir(Paths::PLATFORM) do
        duration = Shell.timed_sh 'yarn run build', 'build platform'
        Reporter.done('platform', 'build', '', duration)
      end
    rescue StandardError
      Reporter.failed('platform', 'build', '')
    end
  end

  desc 'Lint platform'
  task lint: 'platform:install' do
    Shell.chdir(Paths::PLATFORM) do
      duration = Shell.timed_sh 'yarn run lint', 'lint platform'
      Reporter.done('platform', 'linting', '', duration)
    end
  end

  desc 'tsc comile check platform'
  task check: 'platform:install' do
    Shell.chdir(Paths::PLATFORM) do
      duration = Shell.timed_sh 'yarn run check', 'tsc check platform'
      Reporter.done('platform', 'check', '', duration)
    end
  end
end
