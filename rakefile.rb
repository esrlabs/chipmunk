# frozen_string_literal: true

require 'fileutils'
require './scripts/elements/ansi'
require './scripts/elements/bindings'
require './scripts/elements/client'
require './scripts/elements/electron'
require './scripts/elements/release'
require './scripts/elements/updater'
require './scripts/interactive/menu'

namespace :clean do
  desc 'clean every build artifact'
  task all: ['bindings:clean'] do
    Updater.clean
    Matcher.clean
    Ansi.clean
    Utils.clean
    Client.clean
    Platform.clean
    Release.clean
    Electron.clean
    Indexer.clean
  end

  desc 'clean bindings'
  task bindings: ['bindings:clean']

end

desc 'Access interactive menu'
task :default do
  renderInterectiveMenu
end

namespace :install do
  desc 'Install client'
  task :client do
    Client.new(false, false).install
  end

  desc 'Install electron'
  task :electron do
    Electron.new(ElectronSettings.new).install
  end

  desc 'Install rustcore'
  task rustcore: 'bindings:install'

  desc 'Install all'
  task all: ['install:rustcore', 'install:client', 'install:electron'] do
    Reporter.print
  end
end

namespace :build do
  desc 'Build client (dev)'
  task :client_dev do
    Client.delivery(Paths::ELECTRON_DIST, false, true)
    Reporter.print
  end

  desc 'Build client (prod)'
  task :client_prod do
    Client.delivery(Paths::ELECTRON_DIST, true, true)
    Reporter.print
  end

  desc 'Build ts-bindings'
  task bindings: 'bindings:build' do
    Reporter.print
  end

  desc 'Build electron (dev)'
  task :dev do
    Electron.new(ElectronSettings.new).build
    Reporter.print
  end

  desc 'Build electron (prod)'
  task :prod do
    Electron.new(ElectronSettings.new.set_client_prod(true)).build
    Reporter.print
  end

  desc 'Build updater'
  task :updater do
    Updater.build
    Reporter.print
  end

  desc 'Build matcher'
  task :matcher do
    Matcher.new(false, false).build
    Reporter.print
  end

  desc 'Build ansi'
  task :ansi do
    Ansi.new(false, false).build
    Reporter.print
  end

  desc 'Build utils'
  task :utils do
    Utils.new(false, false).build
    Reporter.print
  end
end

# TODO: Oli: remove invokes
namespace :rebuild do
  desc 'Rebuild client (dev)'
  task :client_dev do
    Client.clean
    Rake::Task['build:client_dev'].invoke
  end

  desc 'Rebuild client (prod)'
  task :client_prod do
    Client.clean
    Rake::Task['build:client_prod'].invoke
  end

  desc 'Rebuild ts-bindings'
  task :bindings => 'bindings:clean' do
    Rake::Task['build:bindings'].invoke
  end

  desc 'Rebuild electron (dev)'
  task :dev do
    Electron.clean
    Rake::Task['build:dev'].invoke
  end

  desc 'Rebuild electron (prod)'
  task :prod do
    Electron.clean
    Rake::Task['build:prod'].invoke
  end

  desc 'Rebuild updater'
  task :updater do
    Updater.check(true)
    Reporter.print
  end
end

namespace :developing do
  desc 'Rebuild client (dev) and delivery'
  task :client do
    Rake::Task['build:client_dev'].invoke
  end

  desc 'Recompile rs-bindings and rebuild ts-bindings'
  task :bindings do
    Rake::Task['build:bindings'].invoke
  end

  desc 'Rebuild electron'
  task :electron do
    Electron.new(ElectronSettings.new).build
    Reporter.print
  end

  desc 'Rebuild electron (+ bindings)'
  task :electron_bindings do
    Electron.new(ElectronSettings.new.set_bindings_rebuild(true).set_replace_client(false)).build
    Reporter.print
  end

  desc 'Rebuild electron (+ platform)'
  task :electron_platform do
    Electron.new(ElectronSettings.new.set_platform_rebuild(true)).build
    Reporter.print
  end

  desc 'Rebuild electron (+ platform + bindings)'
  task :electron_platform_bindings do
    Electron.new(ElectronSettings.new.set_platform_rebuild(true).set_bindings_rebuild(true)).build
    Reporter.print
  end


  desc 'Clean & rebuild all'
  task clean_rebuild_all: :clean_all do
    Electron.new(ElectronSettings.new.set_platform_rebuild(true).set_bindings_rebuild(true).set_bindings_reinstall(true)).build
    Reporter.print
  end
end

namespace :release do
  desc 'Production'
  task :prod do
    Release.new(true, true).build
    Reporter.print
  end
  desc 'Developing'
  task :dev do
    Release.new(false, false).build
    Reporter.print
  end
end

namespace :test do
  desc 'run binding tests'
  task bindings: 'bindings:run_tests'

  namespace :matcher do
    desc 'run karma tests'
    task :karma do
      Reporter.print
      Matcher.new(false, false).install
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
    task :karma do
      Reporter.print
      Ansi.new(false, false).install
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
    task :karma do
      Reporter.print
      Utils.new(false, false).install
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
  desc 'Lint electron'
  task :electron do
    Electron.new(ElectronSettings.new).lint
  end

  desc 'Lint client'
  task :client do
    Client.new(false, false).lint
  end

  desc 'Lint TS bindings'
  task ts_bindings: 'bindings:lint'

  desc 'Lint platform'
  task :platform do
    Platform.new(false, false).lint
  end

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
  task all: ['lint:platform', 'lint:electron', 'lint:client', 'lint:ts_bindings', 'lint:clippy'] do
    Reporter.print
  end
end

namespace :env do
  desc 'Install target version of rust'
  task :rust do
    Environment.rust
  end
end

namespace :check do
  desc 'Executes all check before pull request'
  task all: ['build:prod', 'lint:all'] do
    Reporter.print
  end
end

namespace :client do
  desc 'test client'
  task :test do
    client = Client.new(false, true)
    client.build
  end

  desc 'Install client'
  task :install do
    Shell.chdir(Paths::CLIENT) do
      Reporter.log 'Installing client libraries'
      sh 'yarn install'
    end
  end

  desc 'Build client (dev)'
  task :dev do
    Shell.chdir(Paths::CLIENT) do
      sh 'yarn run build'
    end
  end

  desc 'Build client (prod)'
  task :prod do
    Shell.chdir(Paths::CLIENT) do
      sh 'yarn run prod'
    end
  end

  desc 'Clean'
  task :clean do
    Client.clean
  end

  # TODO: Oli: depend on client build
  desc 'Delivery client'
  task :delivery do
    client_dist = "#{Paths::CLIENT_DIST}/#{prod ? 'release' : 'debug'}"
    Dir.mkdir_p(Paths::ELECTRON_DIST)
    FileUtils.cp_r client_dist, Paths::ELECTRON_DIST
  end

  desc 'Install, build and delivery of Client'
  task all: ['client:install', 'client:prod', 'client:delivery']
end

desc 'setup chipmunk to be ready-to-use; use `TARGET=prod rake self_setup` to run in production mode'
task :self_setup do
  is_prod = ENV.fetch('TARGET') && ENV['TARGET'].downcase == 'prod'
  is_prod ? 'prod' : 'dev'

  o_binding = Bindings.new(false)
  changes_to_bindings = o_binding.changes_to_rs || o_binding.changes_to_ts
  o_electron = Electron.new(ElectronSettings.new.set_client_prod(is_prod).set_platform_rebuild(changes_to_bindings))
  o_client = Client.new(false, false)

  o_binding.install
  o_client.install
  o_electron.install

  changes_to_bindings ? o_binding.build : Reporter.skipped('Bindings', 'skipped build since no changes to rustcore', '')
  o_electron.build

  puts 'Execution report : '
  Reporter.print
end
