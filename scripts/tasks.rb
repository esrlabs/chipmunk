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
    Client.delivery(Paths::ELECTRON_DIST, false)
    Reporter.print
  end

  desc 'Build client (prod)'
  task :client_prod do
    Client.delivery(Paths::ELECTRON_DIST, true)
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
    Holder.new(HolderSettings.new.set_bindings_rebuild(true)).build
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

  desc 'Clean & rebuild all'
  task :clean_rebuild_all do
    Client.new(true, true).clean
    Bindings.new(true).clean
    Platform.new(true, true).clean
    Holder.new(HolderSettings.new).clean
    Holder.new(HolderSettings.new.set_platform_rebuild(true).set_bindings_rebuild(true)).build
    Reporter.print
  end
end

test_runner = './node_modules/.bin/electron ./node_modules/jasmine-ts/lib/index.js'

namespace :test do
  desc 'run search tests'
  task :search do
    Bindings.new(false).build
    Reporter.print
    Dir.chdir(Paths::TS_BINDINGS) do
      sh "#{test_runner} spec/session.search.spec.ts"
    end
  end

  desc 'run observe tests'
  task :observe do
    Bindings.new(false).build
    Reporter.print
    Dir.chdir(Paths::TS_BINDINGS) do
      sh "#{test_runner} spec/session.observe.spec.ts"
    end
  end

  desc 'run cancel tests'
  task :cancel do
    Bindings.new(false).build
    Reporter.print
    Dir.chdir(Paths::TS_BINDINGS) do
      sh "#{test_runner} spec/session.cancel.spec.ts"
    end
  end

  desc 'run all test'
  task all: ['test:observe', 'test:search', 'test:cancel']
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
    sh 'rustup default nightly'
    sh 'rustup default stable'
    sh 'rustup component add --toolchain=nightly clippy-preview'
  end

  desc 'Clippy indexer'
  task :indexer do
    Dir.chdir(Paths::INDEXER) do
      sh Paths::CLIPPY_NIGHTLY
    end
  end

  desc 'Clippy rs-bindings'
  task :rs_bindings do
    Dir.chdir(Paths::RS_BINDINGS) do
      sh Paths::CLIPPY_STABLE
    end
  end

  desc 'Clippy all'
  task all: ['clippy:nightly', 'clippy:indexer', 'clippy:rs_bindings']
end

desc 'Executes all check before pull request'
task am_i_ready: ['build:prod', 'lint:all', 'clippy:all'] do
  Reporter.print
end
