# # frozen_string_literal: true

# module Matcher
#   PKG = "#{Paths::MATCHER}/pkg"
#   TARGET = "#{Paths::MATCHER}/target"
#   NODE_MODULES = "#{Paths::MATCHER}/node_modules"
#   TEST_OUTPUT = "#{Paths::MATCHER}/test_output"
#   TARGETS = [PKG, TARGET, NODE_MODULES, TEST_OUTPUT].freeze
# end

# namespace :matcher do
#   task :clean do
#     Matcher::TARGETS.each do |path|
#       path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
#       if File.exist?(path)
#         Shell.rm_rf(path)
#         Reporter.removed('matcher', "removed: #{File.basename(path)}", '')
#       end
#     end
#   end

#   task :wipe_installation do
#     Shell.rm_rf(Matcher::NODE_MODULES)
#   end

#   task reinstall: ['matcher:wipe_installation', 'matcher:install']

#   task :install do
#     Shell.chdir(Paths::MATCHER) do
#       Reporter.log 'Installing matcher libraries'
#       duration = Shell.timed_sh('yarn install', 'yarn install matcher')
#       Reporter.done('matcher', 'installing', '', duration)
#     end
#   end

#   desc 'Build matcher'
#   task build: ['environment:check', 'matcher:install'] do
#     changes_to_files = ChangeChecker.changes?('matcher', Paths::MATCHER)
#     if changes_to_files
#       duration = 0
#       [Matcher::PKG, Matcher::TARGET].each do |path|
#         Shell.rm_rf(path)
#         Reporter.removed('matcher', File.basename(path), '')
#       end
#       Shell.chdir(Paths::MATCHER) do
#         duration = Shell.timed_sh 'wasm-pack build --target bundler', 'wasm-pack build matcher'
#         ChangeChecker.reset('matcher', Paths::MATCHER, Matcher::TARGETS)
#       end
#       Reporter.done('matcher', "build #{Matcher::TARGET}", '', duration)
#     else
#       Reporter.skipped('matcher', 'already built', '')
#     end
#     Reporter.print
#   end

#   task test_karma: 'matcher:install' do
#     Reporter.print
#     Shell.chdir("#{Paths::MATCHER}/spec") do
#       Shell.timed_sh 'npm run test', 'npm test matcher'
#     end
#   end

#   task :test_rust do
#     Reporter.print
#     Shell.chdir(Paths::MATCHER) do
#       Shell.timed_sh 'wasm-pack test --node', 'wasm-pack test matcher'
#     end
#   end

#   desc 'run matcher tests'
#   task test: ['matcher:test_karma', 'matcher:test_rust']
# end
