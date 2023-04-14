require 'fileutils'

puts "#{'=' * 50}"
puts 'This rakefile is DEPRICATED! Please, use root rakefile'
puts "#{'=' * 50}"

# TODO:
# notify user if npm install is required

TS = './ts-bindings'
TS_BUILD = './ts-bindings/dist'
RS = './rs-bindings'
BUILD_ENV = "#{TS}/node_modules/.bin/electron-build-env"
TSC = "#{TS}/node_modules/.bin/tsc"
NJ_CLI = 'nj-cli'
# os detection
module OS
  def self.windows?
    (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM) != nil
  end

  def self.mac?
    (/darwin/ =~ RUBY_PLATFORM) != nil
  end

  def self.unix?
    !OS.windows?
  end

  def self.linux?
    OS.unix? && !OS.mac?
  end
end

namespace :install do
  desc 'Install TS'
  task :ts do
    Dir.chdir(TS) do
      sh 'npm install'
    end
  end

  desc 'install all'
  task all: ['install:ts']
end

namespace :build do
  desc 'Build TS'
  task :ts do
    FileUtils.rm_rf(TS_BUILD) if File.exist?(TS_BUILD)
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
    # Copy native for production
    # dir_prod = "#{TS_BUILD}/native"
    # FileUtils.rm_rf(dir_prod) unless !File.exists?(dir_prod)
    # Dir.mkdir(dir_prod) unless File.exists?(dir_prod)
    sh "cp #{RS}/dist/index.node #{TS_BUILD}/native/index.node"
    # Copy native for tests (jasmine usage)
    dir_tests = "#{TS}/src/native"
    mod_file = "#{dir_tests}/index.node"
    FileUtils.rm(mod_file) if File.exist?(mod_file)
    sh "cp #{RS}/dist/index.node #{TS}/src/native/index.node"
  end

  desc 'build all'
  # task :all do
  #   puts "do nothing in grabber branch"
  # end
  task all: ['build:rs', 'build:ts', 'build:delivery']
end

test_runner = './ts-bindings/node_modules/.bin/electron ./ts-bindings/node_modules/jasmine-ts/lib/index.js'

namespace :test do
  desc 'run search tests'
  task :search do
    sh "#{test_runner} ts-bindings/spec/session.search.spec.ts"
  end

  desc 'run map tests'
  task :map do
    sh "#{test_runner} ts-bindings/spec/session.map.spec.ts"
  end

  desc 'run observe tests'
  task :observe do
    sh "#{test_runner} ts-bindings/spec/session.observe.spec.ts"
  end

  desc 'run errors tests'
  task :errors do
    sh "#{test_runner} ts-bindings/spec/session.errors.spec.ts"
  end

  desc 'run extract tests'
  task :extract do
    sh "#{test_runner} ts-bindings/spec/session.extract.spec.ts"
  end

  desc 'run concat tests'
  task :concat do
    sh "#{test_runner} ts-bindings/spec/session.concat.spec.ts"
  end

  desc 'run merge tests'
  task :merge do
    sh "#{test_runner} ts-bindings/spec/session.merge.spec.ts"
  end

  desc 'run cancel tests'
  task :cancel do
    sh "#{test_runner} ts-bindings/spec/session.cancel.spec.ts"
  end

  desc 'run utils tests'
  task :utils do
    sh "#{test_runner} ts-bindings/spec/utils.spec.ts"
  end

  desc 'run all test'
  task all: ['test:observe', 'test:search', 'test:cancel']

end
