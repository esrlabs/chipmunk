# frozen_string_literal: true

require './scripts/elements/platform'

def command_exists(command)
  require 'open3'
  begin
    _stdout, _stderr, status = Open3.capture3(command)
  rescue StandardError
    puts "command could not be checked: #{command}"
    return false
  end
  puts "command #{command} could not be executed" unless status.success?
  status.success?
end

namespace :environment do
  desc 'check that all needed tools are installed'
  task :check do
    check_protoc
    check_node
    check_rust
    check_nj_cli
    check_wasm_pack
    check_yarn
    Reporter.done('Env', 'checking environment', '')
  end

  desc 'list info of needed tools'
  task :list do
    Shell.sh 'nj-cli -V'
    Shell.sh 'node -v'
    Shell.sh 'yarn -v'
    Shell.sh 'protoc --version'
    # put back in when wasm-pack supports the version again
    # Shell.sh 'wasm-pack -V'
    Shell.sh 'rustup toolchain list'
  end
end

def check_protoc
  return if command_exists('protoc --version')

  raise 'protoc not installed, please install before'
end

def check_node
  return if command_exists('node -v')

  raise 'node not installed, please install before'
end

def check_yarn
  return if command_exists('yarn -v')

  Shell.sh 'npm install --global yarn'
  Reporter.done('Env', 'yarn is installed', '')
end

def check_rust
  return if command_exists('rustup -V')

  output = `rustup toolchain list`
  prefered_rust_version = 'stable'
  is_installed = output.lines.map { |l| l =~ /#{prefered_rust_version}/ }.any? { |x| !x.nil? }
  return if is_installed

  Shell.sh "rustup install #{prefered_rust_version}"
  Reporter.done('Env', "Installed rust (#{prefered_rust_version})", '')
end

def check_nj_cli
  return if command_exists('nj-cli -V')

  Shell.sh 'cargo install nj-cli'
  Reporter.done('Env', 'nj-cli is installed', '')
end

def check_wasm_pack
  return if command_exists('wasm-pack --help')

  Shell.sh 'cargo install wasm-pack'
  Reporter.done('Env', 'wasm-pack is installed', '')
end
