# frozen_string_literal: true

require 'rake/clean'
require 'fileutils'
require 'set'
require './scripts/elements/ansi'
require './scripts/elements/bindings'
require './scripts/elements/client'
require './scripts/elements/electron'
require './scripts/elements/release'
require './scripts/elements/updater'
require './scripts/interactive/menu'
require './scripts/tools/change_checker'

CLOBBER.include("#{Paths::CLIENT}/.angular")
CLOBBER.include('./**/node_modules')

task clean: 'clean:all'

namespace :clean do
  task all: [
    'bindings:clean',
    'electron:clean',
    'client:clean',
    'updater:clean',
    'ansi:clean',
    'utils:clean',
    'platform:clean',
    'release:clean',
    'indexer:clean',
    'matcher:clean',
    'clean_change_list'
  ]
end

desc 'Access interactive menu'
task :default do
  renderInterectiveMenu
end

namespace :install do

  desc 'Install all'
  task all: [
    'ansi:install',
    'matcher:install',
    'utils:install',
    'bindings:install',
    'client:install',
    'electron:install'
  ] do
    Reporter.print
  end
end

namespace :test do
  desc 'run binding tests'
  task bindings: 'bindings:run_tests'

  namespace :matcher do
    desc 'run karma tests'
    task karma: 'matcher:install' do
      Reporter.print
      Shell.chdir("#{Paths::MATCHER}/spec") do
        sh 'npm run test'
      end
    end
    desc 'run rust tests'
    task :rust do
      Reporter.print
      Shell.chdir(Paths::MATCHER) do
        sh 'wasm-pack test --node'
      end
    end
  end

  namespace :ansi do
    desc 'run karma tests'
    task karma: 'ansi:install' do
      Reporter.print
      Shell.chdir("#{Paths::ANSI}/spec") do
        sh 'npm run test'
      end
    end

    desc 'run rust tests'
    task :rust do
      Reporter.print
      Shell.chdir(Paths::ANSI) do
        sh 'wasm-pack test --node'
      end
    end
  end

  namespace :utils do
    desc 'run karma tests'
    task karma: 'utils:install' do
      Reporter.print
      Shell.chdir("#{Paths::UTILS}/spec") do
        sh 'npm run test'
      end
    end

    desc 'run rust tests'
    task :rust do
      Reporter.print
      Shell.chdir(Paths::UTILS) do
        sh 'wasm-pack test --node'
      end
    end
  end
  desc 'run all test'
  task all: ['test:bindings',
             'test:matcher:karma',
             'test:ansi:karma', 'test:ansi:rust', 'test:utils:karma',
             'test:utils:rust', 'test:matcher:rust']
end

# Makes sure clippy is installed and correclty executed
class Clippy
  def initialize
    Rake.sh 'rustup component add clippy'
  end

  def check(owner, path)
    Shell.chdir(path) do
      Rake.sh 'cargo clippy --all --all-features -- -D warnings -A clippy::uninlined_format_args'
    end
    Reporter.other(owner, "checked: #{path}", '')
  end
end

namespace :lint do

  desc 'Clippy indexer'
  task :clippy do
    clippy = Clippy.new
    clippy.check('Indexer', Paths::INDEXER)
    clippy.check('Rustbinding', Paths::RS_BINDINGS)
    clippy.check('Matcher', "#{Paths::MATCHER}/src")
    clippy.check('Ansi', "#{Paths::ANSI}/src")
    clippy.check('Updater', Paths::UPDATER)
    Reporter.print
  end

  desc 'lint all'
  task all: ['platform:lint', 'electron:lint', 'client:lint', 'bindings:lint', 'lint:clippy'] do
    Reporter.print
  end
end

namespace :env do
  desc 'Install target version of rust'
  task :rust do
    Environment.rust
  end
end

desc 'setup chipmunk to be ready-to-use'
task self_setup_dev: ['bindings:build', 'client:build_dev', 'electron:build_dev'] do
  Reporter.print
end

desc 'setup chipmunk to be ready-to-use (production)'
task self_setup_production: ['bindings:build', 'client:build_prod', 'electron:build_prod'] do
  Reporter.print
end

def print_deps
  visited = Set.new
  recursion_stack = Set.new

  puts 'digraph dependencies {'
  Rake::Task.tasks.each do |task|
    print_recursively(task, visited, recursion_stack)
  end
  puts '}'
end

def print_recursively(task, visited, recursion_stack)
  return if visited.include?(task)

  visited.add(task)
  recursion_stack.add(task)

  task.prerequisite_tasks.each do |dependency|
    raise "Cyclic dependency detected: #{task} -> #{dependency}" if recursion_stack.include?(dependency)

    puts "  \"#{task}\" -> \"#{dependency}\""
    print_recursively(dependency, visited, recursion_stack)
  end
  recursion_stack.delete(task)
end

desc 'overview of task dependencies'
task :print_dot do
  print_deps
end

# Put this in Rakefile (doesn't matter where)
require 'benchmark'
class Rake::Task
  def execute_with_benchmark(*args)
    bm = Benchmark.measure { execute_without_benchmark(*args) }
    puts "   #{name} --> #{bm}"
  end

  alias_method :execute_without_benchmark, :execute
  alias_method :execute, :execute_with_benchmark
end

desc 'start chipmunk (dev)'
task run_dev: 'electron:build_dev' do
  cd Paths::ELECTRON do
    Shell.sh 'yarn run electron'
  end
end
