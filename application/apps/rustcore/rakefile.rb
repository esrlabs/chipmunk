# # frozen_string_literal: true

# require 'fileutils'

# puts('=' * 50)
# puts 'This rakefile is DEPRICATED! Please, use root rakefile'
# puts('=' * 50)

# # TODO:
# # notify user if npm install is required

# TS = './ts-bindings'
# TS_BUILD = './ts-bindings/dist'
# TS_LIB_FILE = "#{TS_BUILD}/native/index.node"
# TS_TEST_LIB_FILE = "#{TS}/src/native/index.node"
# RS = './rs-bindings'
# RS_LIB = "#{RS}/dist/index.node"
# BUILD_ENV = "#{TS}/node_modules/.bin/electron-build-env"
# TSC = "#{TS}/node_modules/.bin/tsc"
# NJ_CLI = 'nj-cli'
# # os detection
# module OS
#   def self.windows?
#     (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM) != nil
#   end

#   def self.mac?
#     (/darwin/ =~ RUBY_PLATFORM) != nil
#   end

#   def self.unix?
#     !OS.windows?
#   end

#   def self.linux?
#     OS.unix? && !OS.mac?
#   end
# end

# namespace :install do
#   desc 'Install TS'
#   task :ts do
#     Dir.chdir(TS) do
#       sh 'npm install'
#     end
#   end

#   desc 'install all'
#   task all: ['install:ts']
# end

# namespace :build do
#   desc 'Build TS'
#   task :ts do
#     FileUtils.rm_rf(TS_BUILD)
#     sh "#{TSC} -p #{TS}/tsconfig.json"
#   end

#   file RS_LIB => 'build:rs'

#   desc 'Build RS'
#   task :rs do
#     Dir.chdir(RS) do
#       puts "2"
#       sh "#{BUILD_ENV} #{NJ_CLI} build --release"
#     end
#   end

#   desc 'Delivery native'
#   task delivery: RS_LIB do
#     # Copy native for production and tests (jasmine usage)
#     FileUtils.rm_f(TS_LIB_FILE)
#     FileUtils.rm_f(TS_TEST_LIB_FILE)
#     sh "cp #{RS_LIB} #{TS_LIB_FILE}"
#     sh "cp #{RS_LIB} #{TS_TEST_LIB_FILE}"
#   end

#   desc 'build all'
#   task all: ['build:rs', 'build:ts', 'build:delivery']
# end

# test_runner = './ts-bindings/node_modules/.bin/electron ./ts-bindings/node_modules/jasmine-ts/lib/index.js'

# namespace :test do
#   desc 'run search tests'
#   task :search do
#     sh "#{test_runner} ts-bindings/spec/session.search.spec.ts"
#   end

#   desc 'run map tests'
#   task :map do
#     sh "#{test_runner} ts-bindings/spec/session.map.spec.ts"
#   end

#   desc 'run observe tests'
#   task :observe do
#     sh "#{test_runner} ts-bindings/spec/session.observe.spec.ts"
#   end

#   desc 'run errors tests'
#   task :errors do
#     sh "#{test_runner} ts-bindings/spec/session.errors.spec.ts"
#   end

#   desc 'run extract tests'
#   task :extract do
#     sh "#{test_runner} ts-bindings/spec/session.extract.spec.ts"
#   end

#   desc 'run concat tests'
#   task :concat do
#     sh "#{test_runner} ts-bindings/spec/session.concat.spec.ts"
#   end

#   desc 'run merge tests'
#   task :merge do
#     sh "#{test_runner} ts-bindings/spec/session.merge.spec.ts"
#   end

#   desc 'run cancel tests'
#   task :cancel do
#     sh "#{test_runner} ts-bindings/spec/session.cancel.spec.ts"
#   end

#   desc 'run utils tests'
#   task :utils do
#     sh "#{test_runner} ts-bindings/spec/utils.spec.ts"
#   end

#   desc 'run all test'
#   task all: ['test:observe', 'test:search', 'test:cancel']
# end
