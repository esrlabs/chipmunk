TS = "./ts-bindings"
RS = "./rs-bindings"
BUILD_ENV = "#{TS}/node_modules/.bin/electron-build-env"
TSC = "#{TS}/node_modules/.bin/tsc"
NJ_CLI = 'nj-cli'

namespace :setup do
  task :ts do
    sh "rm #{TS}/package-lock.json || true"
    sh "rm -rf #{TS}/node_modules || true"
    sh "npm install --prefix #{TS}"
  end
end

namespace :build do

  desc "Build TS"
  task :ts do
    sh "#{TSC} -p #{TS}/tsconfig.json"
  end

  desc "Build RS"
  task :rs do
    Dir.chdir(RS) do
      sh ".#{BUILD_ENV} #{NJ_CLI} build --release"
    end
  end

  desc "Delivery native"
  task :delivery do
    sh "rm -rf #{TS}/native || true"
    sh "mkdir #{TS}/native || true"
    sh "cp #{RS}/dist/index.node #{TS}/native/index.node"
  end

  task :all do
    Rake::Task["build:rs"].invoke
    Rake::Task["build:delivery"].invoke
    Rake::Task["build:ts"].invoke
  end
end

