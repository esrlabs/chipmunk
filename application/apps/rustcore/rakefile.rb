TS = "./ts-bindings"
TS_CLI = "./ts-bindings-cli"
RS = "./rs-bindings"
BUILD_ENV = "#{TS}/node_modules/.bin/electron-build-env"
TSC = "#{TS}/node_modules/.bin/tsc"
TSC_CLI = "#{TS_CLI}/node_modules/.bin/tsc"
NJ_CLI = 'nj-cli'

namespace :setup do
  task :ts do
    sh "rm #{TS}/package-lock.json || true"
    sh "rm -rf #{TS}/node_modules || true"
    sh "npm install --prefix #{TS}"
  end
end

namespace :install do
  desc 'Install TS'
  task :ts do
    Dir.chdir(TS) do
      sh 'npm install'
    end
  end

  desc 'Install TS-CLI'
  task :ts_cli do
    Dir.chdir(TS_CLI) do
      sh 'npm install'
    end
  end

  desc 'install all'
  task :all => ['install:ts', 'install:ts_cli']

end

namespace :build do

  desc 'Build TS'
  task :ts do
    sh "#{TSC} -p #{TS}/tsconfig.json"
  end

  desc 'Build RS'
  task :rs do
    Dir.chdir(RS) do
      sh ".#{BUILD_ENV} #{NJ_CLI} build --release"
    end
  end

  desc 'Delivery native'
  task :delivery do
    sh "rm -rf #{TS}/native || true"
    sh "mkdir #{TS}/native || true"
    sh "cp #{RS}/dist/index.node #{TS}/native/index.node"
  end

  desc 'Build TS-CLI'
  task :ts_cli do
    sh "#{TSC_CLI} -p #{TS_CLI}/tsconfig.json"
    file = "#{TS_CLI}/dist/apps/rustcore/ts-bindings-cli/src/index.js"
    link = "#{Dir.pwd}/ts-cli"
    content = File.read(file)
    File.write(file, "#{'#!/usr/bin/env node'}\n#{content}", mode: "w")
    sh "chmod +x #{file}"
    if File.exist?(link)
      sh "rm #{link}"
    end
    sh "ln -s #{file} #{link}"
    sh "chmod +x #{link}"
  end

  desc 'build all'
  task :all => ['build:rs', 'build:delivery', 'build:ts', 'build:ts_cli']
end

