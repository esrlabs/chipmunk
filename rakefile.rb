# frozen_string_literal: true

# NOTE: Rake isn't used in the development anymore and has been replaced
# with Chipmunk Development CLI Tool in `{CHIPMUNK_ROOT}/cli/dev-cli`.
# The implementation here kept for reference.

require 'rake/clean'
require 'fileutils'
require 'set'
require './scripts/elements/wasm'
require './scripts/elements/bindings'
require './scripts/elements/platform'
require './scripts/elements/client'
require './scripts/elements/electron'
require './scripts/elements/release'
require './scripts/elements/updater'
require './scripts/elements/protocol'
require './scripts/tools/change_checker'

CLOBBER.include("#{Paths::CLIENT}/.angular")
CLOBBER.include('./**/node_modules')

task clean: 'clean:all'

namespace :clean do
  task all: [
    'protocol:clean',
    'bindings:clean',
    'electron:clean',
    'client:clean',
    'updater:clean',
    'wasm:clean',
    'platform:clean',
    'release:clean',
    'indexer:clean',
    'clean_change_list'
  ]
end

namespace :test do
  desc 'test rust core'
  task :rust do
    cd Paths::INDEXER do
      Shell.timed_operation(-> { sh 'cargo +stable test' }, 'cargo test')
    end
  end

  desc 'test js/webassembly parts'
  task js: ['bindings:test:all',
            'wasm:test']

  desc 'run all test'
  task all: ['test:rust', 'test:js']
end

# Makes sure clippy is installed and correclty executed
class Clippy
  def initialize
    Rake.sh 'rustup component add clippy'
  end

  def check(owner, path)
    Shell.chdir(path) do
      clippy = 'cargo +stable clippy --all --all-features -- -D warnings -A clippy::uninlined_format_args'
      Shell.timed_operation(-> { Rake.sh clippy}, 'clippy')
      fmt = 'cargo +stable fmt -- --color=always --check'
      Shell.timed_operation(-> { Rake.sh fmt}, 'clippy')
    end
    Reporter.other(owner, "checked: #{path}", '')
  end
end

namespace :lint do
  desc 'lint all rust modules'
  task :rust do
    clippy = Clippy.new
    clippy.check('Indexer', Paths::INDEXER)
    clippy.check('Rustbinding', Paths::RS_BINDINGS)
    clippy.check('Wasm', "#{Paths::WASM}/src")
    clippy.check('Updater', Paths::UPDATER)
    Reporter.print
  end

  desc 'lint all js/ts modules'
  task js: ['platform:lint', 'electron:lint', 'client:lint', 'bindings:lint']

  desc 'lint everything'
  task all: ['lint:js', 'lint:rust'] do
    Reporter.print
  end
end

desc 'check with typscript compiler'
task tsc: ['client:check', 'electron:check', 'platform:check']

desc 'build chipmunk (dev)'
task build_dev: 'electron:build_dev'

desc 'build chipmunk (prod)'
task build_prod: 'electron:build_prod'

def visible_tasks
  visible = `rake -T`
  visible.lines.map do |line|
    if (match = line.match(/rake\s([\w:]*)/i))
      one = match.captures
      one[0]
    end
  end
end

def print_deps
  visited = Set.new
  recursion_stack = Set.new
  puts 'digraph dependencies {'
  visible_tasks.each do |t|
    puts "\s\s\"#{t}\" [style=filled,color=\"orange\"];"
  end
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

desc 'start chipmunk (dev)'
task run_dev: 'electron:build_dev' do
  cd Paths::ELECTRON do
    Shell.sh 'yarn run electron'
  end
end

desc 'start chipmunk (prod)'
task run_prod: 'electron:build_prod' do
  cd Paths::ELECTRON do
    Shell.sh 'yarn run electron'
  end
end

# # uncomment for benchmarking the tasks
# require 'benchmark'
# class Rake::Task
#   def execute_with_benchmark(*args)
#     bm = Benchmark.measure { execute_without_benchmark(*args) }
#     puts "   #{name} --> #{bm}"
#   end

#   alias_method :execute_without_benchmark, :execute
#   alias_method :execute, :execute_with_benchmark
# end
