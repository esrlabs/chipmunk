# # frozen_string_literal: true

# module Utils
#   PKG = "#{Paths::UTILS}/pkg"
#   TARGET = "#{Paths::UTILS}/target"
#   NODE_MODULES = "#{Paths::UTILS}/node_modules"
#   TEST_OUTPUT = "#{Paths::UTILS}/test_output"
#   TARGETS = [PKG, TARGET, NODE_MODULES, TEST_OUTPUT].freeze
# end

# namespace :utils do
#   task :clean do
#     Utils::TARGETS.each do |path|
#       path = "#{path}/.node_integrity" if File.basename(path) == 'node_modules'
#       if File.exist?(path)
#         Shell.rm_rf(path)
#         Reporter.removed('utils', "removed: #{File.basename(path)}", '')
#       end
#     end
#   end

#   task :wipe_installation do
#     Shell.rm_rf(Utils::NODE_MODULES)
#   end

#   task reinstall: ['utils:wipe_installation', 'utils:install']

#   task :install do
#     Shell.chdir(Paths::UTILS) do
#       Reporter.log 'Installing utils libraries'
#       duration = Shell.timed_sh('yarn install', 'yarn install utils')
#       Reporter.done('utils', 'installing', '', duration)
#     end
#   end

#   desc 'Build utils'
#   task build: ['environment:check', 'utils:install'] do
#     changes_to_files = ChangeChecker.changes?('utils', Paths::UTILS)
#     if changes_to_files
#       duration = 0
#       [Utils::PKG, Utils::TARGET].each do |path|
#         Shell.rm_rf(path)
#         Reporter.removed('utils', File.basename(path), '')
#       end
#       Shell.chdir(Paths::UTILS) do
#         duration = Shell.timed_sh 'wasm-pack build --target bundler', 'wasm-pack build utils'
#         ChangeChecker.reset('utils', Paths::UTILS, Utils::TARGETS)
#       end
#       Reporter.done('utils', "build #{Utils::TARGET}", '', duration)
#     else
#       Reporter.skipped('utils', 'already built', '')
#     end
#     Reporter.print
#   end

#   task test_karma: 'utils:install' do
#     Reporter.print
#     Shell.chdir("#{Paths::UTILS}/spec") do
#       Shell.timed_sh 'npm run test', 'npm test utils'
#     end
#   end

#   task :test_rust do
#     Reporter.print
#     Shell.chdir(Paths::UTILS) do
#       Shell.timed_sh 'wasm-pack test --node', 'wasm-pack test utils'
#     end
#   end

#   desc 'run utils tests'
#   task test: ['utils:test_karma', 'utils:test_rust']
# end
