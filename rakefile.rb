require 'fileutils'
require './scripts/elements/client'
require './scripts/elements/ansi'
require './scripts/elements/bindings'
require './scripts/elements/electron'
require './scripts/elements/updater'
require './scripts/interactive/menu'

desc 'Access interactive menu'
task :default do
  renderInterectiveMenu
end

namespace :install do
  desc 'Install client'
  task :client do
    Client.new(false, false).install
  end

  desc 'Install holder'
  task :holder do
    Holder.new(HolderSettings.new).install
  end

  desc 'Install rustcore'
  task :rustcore do
    Bindings.new(false).install
  end

  desc 'Install all'
  task all: ['install:rustcore', 'install:client', 'install:holder'] do
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
  task :bindings do
    Bindings.new(false).build
    Reporter.print
  end

  desc 'Build holder (dev)'
  task :dev do
    Holder.new(HolderSettings.new).build
    Reporter.print
  end

  desc 'Build holder (prod)'
  task :prod do
    Holder.new(HolderSettings.new.set_client_prod(true)).build
    Reporter.print
  end

  desc 'Build updater'
  task :updater do
    Updater.new.build
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

namespace :rebuild do
  desc 'Rebuild client (dev)'
  task :client_dev do
    Client.new(false, false).clean
    Rake::Task['build:client_dev'].invoke
  end

  desc 'Rebuild client (prod)'
  task :client_prod do
    Client.new(false, false).clean
    Rake::Task['build:client_prod'].invoke
  end

  desc 'Rebuild ts-bindings'
  task :bindings do
    Bindings.new(true).clean
    Rake::Task['build:bindings'].invoke
  end

  desc 'Rebuild holder (dev)'
  task :dev do
    Holder.new(HolderSettings.new.set_bindings_rebuild(true).set_platform_rebuild(true)).clean
    Rake::Task['build:dev'].invoke
  end

  desc 'Rebuild holder (prod)'
  task :prod do
    Holder.new(HolderSettings.new.set_bindings_rebuild(true).set_platform_rebuild(true).set_client_prod(true)).clean
    Rake::Task['build:prod'].invoke
  end

  desc 'Rebuild updater'
  task :updater do
    Updater.new.check(true)
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

  desc 'Rebuild holder'
  task :holder do
    Holder.new(HolderSettings.new).build
    Reporter.print
  end

  desc 'Rebuild holder (+ bindings)'
  task :holder_bindings do
    Holder.new(HolderSettings.new.set_bindings_rebuild(true).set_replace_client(false)).build
    Reporter.print
  end

  desc 'Rebuild holder (+ platform)'
  task :holder_platform do
    Holder.new(HolderSettings.new.set_platform_rebuild(true)).build
    Reporter.print
  end

  desc 'Rebuild holder (+ platform + bindings)'
  task :holder_platform_bindings do
    Holder.new(HolderSettings.new.set_platform_rebuild(true).set_bindings_rebuild(true)).build
    Reporter.print
  end

  desc 'Clean all'
  task :clean_all do
    Updater.new.clean
    Matcher.new(true, true).clean
    Ansi.new(true, true).clean
    Utils.new(true, true).clean
    Client.new(true, true).clean
    Bindings.new(true).clean
    Platform.new(true, true).clean
    Release.new(true, true).clean
    Holder.new(HolderSettings.new).clean
  end

  desc 'Clean & rebuild all'
  task :clean_rebuild_all do
    Updater.new.clean
    Matcher.new(true, true).clean
    Ansi.new(true, true).clean
    Utils.new(true, true).clean
    Client.new(true, true).clean
    Bindings.new(true).clean
    Platform.new(true, true).clean
    Release.new(true, true).clean
    Holder.new(HolderSettings.new).clean
    Holder.new(HolderSettings.new.set_platform_rebuild(true).set_bindings_rebuild(true).set_bindings_reinstall(true)).build
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
  namespace :binding do
    desc 'run jobs tests'
    task :jobs do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.jobs.spec.js"
      end
    end

    desc 'run search tests'
    task :search do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.search.spec.js"
      end
    end

    desc 'run values tests'
    task :values do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.values.spec.js"
      end
    end

    desc 'run extract tests'
    task :extract do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.extract.spec.js"
      end
    end

    desc 'run ranges tests'
    task :ranges do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.ranges.spec.js"
      end
    end

    desc 'run exporting tests'
    task :exporting do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.exporting.spec.js"
      end
    end

    desc 'run map tests'
    task :map do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.map.spec.js"
      end
    end

    desc 'run observe tests'
    task :observe do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.observe.spec.js"
      end
    end

    desc 'run indexes tests'
    task :indexes do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.indexes.spec.js"
      end
    end

    desc 'run concat tests'
    task :concat do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.concat.spec.js"
      end
    end

    desc 'run cancel tests'
    task :cancel do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.cancel.spec.js"
      end
    end

    desc 'run errors tests'
    task :errors do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.errors.spec.js"
      end
    end

    desc 'run stream tests'
    task :stream do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.stream.spec.js"
      end
    end

    desc 'run promises tests'
    task :promises do
      Bindings.new(false).build
      Bindings.new(false).build_spec
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{Paths::JASMINE} spec/build/spec/session.promises.spec.js"
      end
    end
  end
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
  task all: ['test:binding:observe', 'test:binding:concat', 'test:binding:extract',
             'test:binding:ranges', 'test:binding:exporting', 'test:binding:search',
             'test:binding:cancel', 'test:binding:errors', 'test:binding:map',
             'test:binding:jobs', 'test:binding:promises', 'test:binding:values',
             'test:binding:indexes', 'test:binding:stream', 'test:matcher:karma',
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
  desc 'Lint holder'
  task :holder do
    Holder.new(HolderSettings.new).lint
  end

  desc 'Lint client'
  task :client do
    Client.new(false, false).lint
  end

  desc 'Lint TS bindings'
  task :ts_bindings do
    Bindings.new(false).lint
  end

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
  task all: ['lint:platform', 'lint:holder', 'lint:client', 'lint:ts_bindings', 'lint:clippy'] do
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
  task all: ['build:prod', 'lint:all', 'clippy:all'] do
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
    Shell.rm_rf(Paths::CLIENT_DIST)
    Shell.rm_rf(Paths::ELECTRON_CLIENT_DEST)
  end

  desc 'Delivery client'
  task :delivery do
    client_dist = "#{Paths::CLIENT_DIST}/#{prod ? 'release' : 'debug'}"
    Dir.mkdir(Paths::ELECTRON_DIST) unless File.exist?(Paths::ELECTRON_DIST)
    sh "cp -r #{client_dist} #{Paths::ELECTRON_DIST}"
  end

  desc 'Install, build and delivery of Client'
  task all: ['client:install', 'client:clean', 'client:prod', 'client:delivery']
end

visible_tasks = %w(verbose am_i_ready install:all test:all developing:clean_rebuild_all self_setup)
Rake::Task.tasks.each do |task|
  visible_tasks.include?(task.name) or task.clear_comments
end

desc 'Display commands for granular tasks'
task :verbose do
  Rake::Task.tasks.each {|task| puts "rake #{task.name}" if !visible_tasks.include?(task.name)}
end

desc 'setup chipmunk to be ready-to-use; use `TARGET=prod rake self_setup` to run in production mode'
task :self_setup do
  is_prod = ENV['TARGET'] && ENV['TARGET'].downcase == 'prod'
  current_env = is_prod ? 'prod' : 'dev'

  o_binding = Bindings.new(false)
  changes_to_bindings = o_binding.changes_to_rs || o_binding.changes_to_ts
  o_holder = Holder.new(HolderSettings.new.set_client_prod(is_prod).set_platform_rebuild(changes_to_bindings))
  o_client = Client.new(false, false)

  o_binding.install
  o_client.install
  o_holder.install

  changes_to_bindings ? o_binding.build : Reporter.skipped('Bindings', 'skipped build since no changes to rustcore', '')
  o_holder.build

  puts "Execution report : "
  Reporter.print
end
