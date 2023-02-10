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

  desc 'install all'
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

test_runner = './node_modules/.bin/electron ./node_modules/jasmine-ts/lib/index.js'

namespace :test do
  namespace :binding do
    desc 'run search tests'
    task :search do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.search.spec.ts"
      end
    end

    desc 'run values tests'
    task :values do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.values.spec.ts"
      end
    end

    desc 'run extract tests'
    task :extract do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.extract.spec.ts"
      end
    end

    desc 'run ranges tests'
    task :ranges do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.ranges.spec.ts"
      end
    end

    desc 'run exporting tests'
    task :exporting do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.exporting.spec.ts"
      end
    end

    desc 'run map tests'
    task :map do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.map.spec.ts"
      end
    end

    desc 'run observe tests'
    task :observe do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.observe.spec.ts"
      end
    end

    desc 'run indexes tests'
    task :indexes do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.indexes.spec.ts"
      end
    end

    desc 'run concat tests'
    task :concat do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.concat.spec.ts"
      end
    end

    desc 'run cancel tests'
    task :cancel do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.cancel.spec.ts"
      end
    end

    desc 'run errors tests'
    task :errors do
      Bindings.new(false).build
      Reporter.print
      Shell.chdir(Paths::TS_BINDINGS) do
        sh "#{test_runner} spec/session.errors.spec.ts"
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
  desc 'run all test'
  task all: ['test:binding:observe', 'test:binding:concat', 'test:binding:extract',
             'test:binding:ranges', 'test:binding:exporting', 'test:binding:search',
             'test:binding:cancel', 'test:binding:errors', 'test:binding:map',
             'test:matcher:karma', 'test:matcher:rust', 'test:ansi:karma',
             'test:binding:values', 'test:binding:indexes', 'test:ansi:rust']
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

  desc 'lint all'
  task all: ['lint:platform', 'lint:holder', 'lint:client', 'lint:ts_bindings'] do
    Reporter.print
  end
end

namespace :clippy do
  desc 'Clippy update to nightly'
  task :nightly do
    sh 'rustup install nightly'
    sh 'rustup default nightly'
    sh 'rustup component add --toolchain=nightly clippy-preview'
  end

  desc 'Clippy indexer'
  task :indexer do
    Reporter.add(Jobs::Clippy, Owner::Indexer, "checked: #{Paths::INDEXER}", '')
    Shell.chdir(Paths::INDEXER) do
      sh Paths::CLIPPY_NIGHTLY
    end
  end

  desc 'Clippy rs-bindings'
  task :rs_bindings do
    Shell.chdir(Paths::RS_BINDINGS) do
      sh Paths::CLIPPY_NIGHTLY
    end
    Reporter.add(Jobs::Clippy, Owner::Rustcore, "checked: #{Paths::RS_BINDINGS}", '')
  end

  desc 'Clippy matcher'
  task :matcher do
    Shell.chdir("#{Paths::MATCHER}/src") do
      sh Paths::CLIPPY_NIGHTLY
    end
    Reporter.add(Jobs::Clippy, Owner::Matcher, "checked: #{Paths::MATCHER}", '')
  end

  desc 'Clippy ansi'
  task :ansi do
    Shell.chdir("#{Paths::ANSI}/src") do
      sh Paths::CLIPPY_NIGHTLY
    end
    Reporter.add(Jobs::Clippy, Owner::Ansi, "checked: #{Paths::ANSI}", '')
  end

  desc 'Clippy updater'
  task :updater do
    Shell.chdir("#{Paths::UPDATER}") do
      sh Paths::CLIPPY_NIGHTLY
    end
    Reporter.add(Jobs::Clippy, Owner::Updater, "checked: #{Paths::UPDATER}", '')
  end

  desc 'Clippy all'
  task all: ['clippy:nightly', 'clippy:indexer', 'clippy:rs_bindings', 'clippy:matcher', 'clippy:ansi',
             'clippy:updater'] do
    Reporter.print
  end
end

namespace :env do
  desc 'Install target version of rust'
  task :rust do
    config = Config.new
    sh "rustup install #{config.get_rust_version}"
    sh "rustup default #{config.get_rust_version}"
  end
end

desc 'Executes all check before pull request'
task am_i_ready: ['build:prod', 'lint:all', 'clippy:all'] do
  Reporter.print
end
