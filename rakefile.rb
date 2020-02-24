# frozen_string_literal: true

require 'fileutils'
require 'open-uri'
require 'json'
require 'pathname'
require 'uri'
require 'rake/clean'
require './rake-extensions'

NPM_RUN = 'npm run --quiet'

ELECTRON_VERSION = '7.1.1'
ELECTRON_REBUILD_VERSION = '1.8.6'
RIPGREP_VERSION = '11.0.2'
NEON_CLI_NPM_VERSION = '0.3.1'
TYPESCRIPT_NPM_VERSION = '3.5.1'
ELECTRON_DIR = 'application/electron'
ELECTRON_COMPILED_DIR = "#{ELECTRON_DIR}/dist/compiled"
ELECTRON_RELEASE_DIR = "#{ELECTRON_DIR}/dist/release"
APPS_DIR = 'application/apps'
CLIENT_CORE_DIR = 'application/client.core'
CLIENT_PLUGIN_DIR = 'application/client.plugins'

INCLUDED_PLUGINS_FOLDER = "#{ELECTRON_COMPILED_DIR}/plugins"
INCLUDED_APPS_FOLDER = "#{ELECTRON_COMPILED_DIR}/apps"
APP_PACKAGE_JSON = "#{ELECTRON_DIR}/package.json"
SRC_CLIENT_NPM_LIBS = 'application/client.libs/chipmunk.client.components'
RIPGREP_URL = "https://github.com/BurntSushi/ripgrep/releases/download/#{RIPGREP_VERSION}/ripgrep-#{RIPGREP_VERSION}"
RIPGREP_LOCAL_TMP = File.join(Dir.home, 'tmp/ripgrep_download')

DESTS_CLIENT_NPM_LIBS = [
  "#{CLIENT_CORE_DIR}/node_modules",
  "#{CLIENT_PLUGIN_DIR}/node_modules"
].freeze
CLIENT_NPM_LIBS_NAMES = %w[
  chipmunk-client-containers
  chipmunk-client-primitive
  chipmunk-client-complex
].freeze
COMPLEX_PLUGINS = %w[
  serial
  processes
  xterminal
].freeze
ANGULAR_PLUGINS = ['dlt-render'].freeze
STANDALONE_PLUGINS = ['row.parser.ascii'].freeze

PLUGINS_SANDBOX = 'application/sandbox'

directory ELECTRON_COMPILED_DIR
directory ELECTRON_RELEASE_DIR
directory INCLUDED_PLUGINS_FOLDER
directory INCLUDED_APPS_FOLDER
directory RIPGREP_LOCAL_TMP

FOLDERS_TO_CLEAN = [
  ELECTRON_COMPILED_DIR,
  ELECTRON_RELEASE_DIR,
  INCLUDED_PLUGINS_FOLDER,
  INCLUDED_APPS_FOLDER
].freeze
CLEAN.include(FOLDERS_TO_CLEAN)
task :rust_clean do
  %w[launcher updater indexer].each do |rust_app|
    cd Pathname.new(APPS_DIR).join(rust_app), verbose: false do
      sh 'cargo clean'
    end
  end
end

task clean: :rust_clean
CLOBBER.include([
                  '**/node_modules',
                  '**/dist',
                  "#{APPS_DIR}/indexer/target",
                  "#{APPS_DIR}/indexer-neon/dist",
                  "#{APPS_DIR}/indexer-neon/native/target"
                ])

task folders: [ELECTRON_COMPILED_DIR,
               ELECTRON_RELEASE_DIR,
               INCLUDED_PLUGINS_FOLDER,
               INCLUDED_APPS_FOLDER]

task :clean_electron do
  rm_f "#{ELECTRON_DIR}/dist"
end

task :clean_javascript => :clean_electron do
  Dir.glob('**/dist').each do |d|
    unless d =~ /node_modules/
      rm_r d if Dir.exist? d
    end
  end
end

def rust_exec_in_build_dir(name)
  app_name = "#{APPS_DIR}/#{name}/target/release/#{name}"
  if OS.windows?
    "#{app_name}.exe"
  else
    app_name
  end
end

def deployed_rust_exec(name)
  app_name = "#{INCLUDED_APPS_FOLDER}/#{name}"
  if OS.windows?
    "#{app_name}.exe"
  else
    app_name
  end
end

def target_platform_alias
  if OS.windows?
    'win'
  elsif OS.mac?
    'mac'
  else
    'linux'
  end
end

def target_platform_name
  if OS.windows?
    'win64'
  elsif OS.mac?
    'darwin'
  else
    'linux'
  end
end

def nodejs_platform
  if OS.windows?
    'win32'
  elsif OS.mac?
    'darwin'
  else
    'linux'
  end
end

puts "Detected target platform is: #{target_platform_name} / #{target_platform_alias}"

def compress_plugin(file, dest)
  if OS.windows?
    sh "tar -czf #{file} -C #{PLUGINS_SANDBOX} #{dest} --force-local"
  else
    sh "tar -czf #{file} -C #{PLUGINS_SANDBOX} #{dest} "
  end
end

desc 'use local verdaccio registry'
task :use_local_registry do
  switch_lock_files_to_local_server
end
desc 'use default npm registry'
task :use_npm_registry do
  switch_lock_files_to_npm_server
end
def switch_lock_files_to_npm_server
  FileList['**/package-lock.json'].each do |lock_f|
    text = File.read(lock_f)
    new_contents = text.gsub(/http:\/\/localhost:4873/, "https:\/\/registry.npmjs.org")
    File.open(lock_f, 'w') { |file| file.puts new_contents }
  end
end

def switch_lock_files_to_local_server
  FileList['**/package-lock.json'].each do |lock_f|
    text = File.read(lock_f)
    new_contents = text.gsub(/https:\/\/registry.npmjs.org/, "http:\/\/localhost:4873")
    File.open(lock_f, 'w') { |file| file.puts new_contents }
  end
end

def npm_install(what = '')
  sh "npm install #{what} --prefere-offline"
end

def npm_force_resolutions
  sh 'npx npm-force-resolutions'
end

def npm_reinstall(package_and_version)
  xs = package_and_version.split('@')
  package = xs[0]
  version = xs[1]
  sh "npm uninstall #{package}"
  sh "npm install #{package}@#{version} --prefere-offline"
end

desc 'start'
task start: :ripgrepdelivery do
  # config_windows_path = File.join(Dir.home, '.chipmunk', 'config.window.json')
  # rm_f config_windows_path
  ENV['CHIPMUNK_DEVELOPING_MODE'] = 'ON'
  cd ELECTRON_DIR do
    require 'dotenv/load'
    if OS.windows?
      sh "#{NPM_RUN} electron-win"
    else
      sh "#{NPM_RUN} electron"
    end
  end
end

def check_program(existence_check, warning)
  sh existence_check do |ok, _res|
    abort warning unless ok
  end
end
desc 'checking local environment'
task :check_environment do
  check_program('node --version', 'NodeJS is required. Please install NodeJS')
  check_program('cargo --version', 'Rust is required. Please install Rust')
  check_program('python --version', 'Python is required. Please install Python')
  check_program('tsc --version',
                'Typescript is required. Please install it globally using '\
                "\"npm install typescript@#{TYPESCRIPT_NPM_VERSION} --global\". "\
                "Note, to avoid potential conflicts, it's better to use a suggested version.")
  check_program('neon version',
                'Neon CLI is required. Please install it globally using '\
                "\"npm install neon-cli@#{NEON_CLI_NPM_VERSION} --global\""\
                ". Note, to avoid potential conflicts, it's better to use a suggested version.")
  check_program('gem list -i dotenv', 'Dotenv is required. Please install it globally using "gem install dotenv".')
end

desc 'setup build environment'
task :setup_environment do
  puts 'Updateing process'
  if OS.windows?
    config_file_path = File.join(Dir.home, '.cargo', 'config')
    needs_entry = false
    if !File.exist?(config_file_path)
      needs_entry = true
    else
      config_content = File.read(config_file_path)
      needs_entry = config_content !~ /__pfnDliNotifyHook2/
    end
    if needs_entry
      File.open(config_file_path, 'a') do |f|
        f.puts ''
        ["[target.'cfg(windows)']",
         'rustflags = ["-C", "link-args=/DELAYLOAD:node.exe /INCLUDE:__pfnDliNotifyHook2 delayimp.lib"]']
          .each { |line| f.puts(line) }
      end
    end
  end
end

def rg_executable
  "#{INCLUDED_APPS_FOLDER}/#{OS.windows? ? 'rg.exe' : 'rg'}"
end

def rg_uri
  if OS.mac?
    URI.parse("#{RIPGREP_URL}-x86_64-apple-darwin.tar.gz")
  elsif OS.linux?
    URI.parse("#{RIPGREP_URL}-x86_64-unknown-linux-musl.tar.gz")
  elsif OS.windows?
    URI.parse("#{RIPGREP_URL}-x86_64-pc-windows-msvc.zip")
  end
end

file rg_executable => RIPGREP_LOCAL_TMP do
  puts 'creating rg executable'
  file_name = rg_uri.path.split('/').last
  downloaded_rg = if OS.mac? || OS.linux?
                    "#{RIPGREP_LOCAL_TMP}/#{File.basename(file_name, '.tar.gz')}/rg"
                  elsif OS.windows?
                    "#{RIPGREP_LOCAL_TMP}/rg.exe"
                  end
  unless File.exist? downloaded_rg
    File.open("#{RIPGREP_LOCAL_TMP}/#{file_name}", 'wb') do |file|
      file << rg_uri.read
      puts "downloaded #{rg_uri}"
    end
    if OS.mac? || OS.linux?
      cd RIPGREP_LOCAL_TMP do
        sh "tar xvzf #{file_name}"
      end
    elsif OS.windows?
      cd RIPGREP_LOCAL_TMP do
        sh "unzip #{file_name}"
      end
    end
  end
  rm(rg_executable, force: true)
  cp(downloaded_rg, rg_executable)
end

task ripgrepdelivery: [:folders, rg_executable]

namespace :client do
  task :rebuild_core do
    cd CLIENT_CORE_DIR do
      puts 're-installing: core'
      npm_install
      npm_reinstall('chipmunk.client.toolkit@latest')
      npm_force_resolutions
    end
  end

  # setup file dependencies for chipmunk.client.components installation
  components_installation = 'application/client.libs/chipmunk.client.components/node_modules'
  file components_installation => FileList['application/client.libs/chipmunk.client.components/*.json'] do |_t|
    cd 'application/client.libs/chipmunk.client.components' do
      puts 'Installing: components'
      npm_install
      npm_force_resolutions
      touch 'node_modules'
    end
  end
  task install_components: components_installation

  # setup file dependencies for chipmunk.client.toolkit installation
  plugin_toolkit_installation = "#{CLIENT_PLUGIN_DIR}/node_modules/chipmunk.client.toolkit"
  file plugin_toolkit_installation => FileList["#{CLIENT_PLUGIN_DIR}/*.json"] do |_t|
    cd CLIENT_PLUGIN_DIR do
      npm_install
      npm_install('chipmunk.client.toolkit@latest')
      npm_force_resolutions
    end
  end
  task build_plugins: plugin_toolkit_installation

  # this task will create the ressources in application/electron/dist/client
  task create_resources: :compile_neon_ts

  # setup file dependencies for those ressources
  dest_client_path = "#{ELECTRON_COMPILED_DIR}/client"
  build_target_file = "#{dest_client_path}/main.js"
  file build_target_file => FileList[
                               "#{CLIENT_CORE_DIR}/src/**/*.*",
                               "#{CLIENT_CORE_DIR}/e2e/**/*.*",
                               "#{CLIENT_CORE_DIR}/*.json"] do |_t|
    # puts t.investigation
    cd CLIENT_CORE_DIR do
      puts 'Building client.core'
      sh "#{NPM_RUN} build"
    end
    puts 'Delivery client.core'
    rm_r(dest_client_path, force: true)
    cp_r("#{CLIENT_CORE_DIR}/dist/logviewer", dest_client_path, verbose: false)
  end
  task create_resources: build_target_file

  client_plugins_node_installation = "#{CLIENT_PLUGIN_DIR}/node_modules"
  # make sure we update if json config files change => compare date of node_modules
  file client_plugins_node_installation => FileList["#{CLIENT_PLUGIN_DIR}/*.json"] do |_t|
    puts "NPM isn't installed in project application/client.plugin. Installing..."
    cd CLIENT_PLUGIN_DIR do
      npm_install
      npm_force_resolutions
      touch 'node_modules'
    end
  end

  core_node_installation = "#{CLIENT_CORE_DIR}/node_modules"
  # make sure we update if json config files change => compare date of node_modules
  file core_node_installation => FileList["#{CLIENT_CORE_DIR}/*.json"] do |_t|
    puts "NPM isn't installed in project #{CLIENT_CORE_DIR}. Installing..."
    cd CLIENT_CORE_DIR do
      npm_install
      npm_force_resolutions
      touch 'node_modules'
    end
  end

  core_toolkit_installation = "#{CLIENT_CORE_DIR}/node_modules/chipmunk.client.toolkit"
  file core_toolkit_installation => FileList["#{CLIENT_CORE_DIR}/*.json"] do |_t|
    cd CLIENT_CORE_DIR do
      npm_install
      npm_force_resolutions
      npm_install('chipmunk.client.toolkit@latest')
    end
  end
  task build_core: core_toolkit_installation

  task build_and_deliver_libs: [:build_libs, core_node_installation, client_plugins_node_installation] do
    puts 'Delivery client libs'
    DESTS_CLIENT_NPM_LIBS.each do |dest|
      CLIENT_NPM_LIBS_NAMES.each do |lib|
        src = "#{SRC_CLIENT_NPM_LIBS}/dist/#{lib}"
        dest_path = "#{dest}/#{lib}"
        puts src
        puts dest_path
        rm_r(dest_path, force: true)
        cp_r(src, dest_path, verbose: false)
      end
    end
  end

  desc 'build client libs'
  task :build_libs

  CLIENT_NPM_LIBS_NAMES.each do |lib|
    target_file = "#{SRC_CLIENT_NPM_LIBS}/dist/#{lib}/public_api.d.ts"
    file target_file => FileList["#{SRC_CLIENT_NPM_LIBS}/projects/#{lib}/**/*.*"] do
      cd SRC_CLIENT_NPM_LIBS do
        puts 'Installing: components'
        sh "#{NPM_RUN} build:#{lib}"
      end
    end
    task build_libs: target_file
  end
end
# namespace client

desc 'do compile electron stuff'
task compile_electron: [:prepare_electron_build,
                        :native,
                        'dev:neon',
                        :electron_build_ts]

prepare_electron_application = 'application/electron/node_modules'
# make sure we update if json config files change => compare date of node_modules
file prepare_electron_application => FileList['application/electron/*.json'] do |_t|
  puts "NPM isn't installed in project application/electron. Installing..."
  cd ELECTRON_DIR do
    npm_install
    npm_force_resolutions
    touch 'node_modules'
  end
end

task prepare_electron_build: prepare_electron_application

desc 'ts build electron (needed when ts files are changed)'
task :electron_build_ts do
  cd ELECTRON_DIR do
    sh "#{NPM_RUN} build-ts"
  end
end

desc 're-install'
task reinstall: [:folders,
                 'client:rebuild_core',
                 'client:install_components',
                 :compile_electron,
                 'client:build_and_deliver_libs',
                 'client:create_resources',
                 :add_package_json]
desc 'install'
task install: [:folders,
               'client:build_core',
               'client:install_components',
               :compile_electron,
               'client:build_and_deliver_libs',
               'client:create_resources',
               :add_package_json]

namespace :dev do
  task :serial_render do
    install_plugin_angular('serial')
  end

  task :processes_render do
    install_plugin_angular('processes')
  end

  task :dltrender_render do
    install_plugin_angular('dlt-render')
  end

  task :xterminal_render do
    install_plugin_angular('xterminal')
  end

  desc 'Developer task: update and delivery indexer-neon'
  task neon: %i[build_embedded_indexer delivery_embedded_into_local_runtime]

  task update_client: ['client:create_resources']

  desc 'Developer task: update client and libs'
  task fullupdate_client: ['client:build_and_deliver_libs', :update_client]

  # Application should be built already to use this task
  desc 'Developer task: build launcher and delivery into package.'
  task build_delivery_apps: %i[build_launcher build_updater] do
    node_app_original = app_path_in_electron_dist('chipmunk')
    rm(node_app_original)
    cp(rust_exec_in_build_dir('launcher'), node_app_original)
  end

  desc 'quick release'
  task quick_release: %i[folders
                         compile_electron
                         add_package_json
                         ripgrepdelivery
                         build_and_package_electron
                         create_release_file_list]
end

task :add_package_json do
  cp_r(APP_PACKAGE_JSON, "#{ELECTRON_COMPILED_DIR}/package.json")
end

task plugins: %i[folders install_plugins_standalone install_plugins_complex install_plugins_angular]

def plugin_bundle_name(plugin, kind)
  dest = "#{PLUGINS_SANDBOX}/#{plugin}"
  package_str = File.read("#{dest}/#{kind}/package.json")
  package = JSON.parse(package_str)
  "#{INCLUDED_PLUGINS_FOLDER}/#{plugin}@#{package['version']}-#{nodejs_platform}.tgz"
end

desc 'run all tests'
task :test do
  %w[launcher updater indexer].each do |rust_app|
    cd Pathname.new(APPS_DIR).join(rust_app), verbose: false do
      begin
        sh 'cargo test'
      rescue StandardError => e
        puts "error while running tests for #{rust_app}: #{e}"
      end
    end
  end
end

def collect_ts_lint_scripts
  lint_scripts = []
  FileList['**/package.json']
    .reject { |f| f =~ /node_modules/ || f =~ /dist\/compiled/ || f =~ /sandbox\/row\.parser\.ascii/ }
    .each do |f|
    package = JSON.parse(File.read(f))
    scripts = package['scripts']
    next if scripts.nil?

    scripts.each do |s|
      if s.count == 2
        runner = s[1]
        lint_scripts << [File.dirname(f), s[0], runner] if runner =~ /(tslint|ng\slint)/
      end
    end
  end
  lint_scripts
end

def run_ts_lint(include_tsc_checks)
  require 'open3'
  errors = []
  lint_scripts = collect_ts_lint_scripts
  lint_scripts.each { |s| puts "  * #{s[0]}" }
  lint_scripts.each do |lint|
    dir = lint[0]
    runner = lint[2]
    runner = runner.sub!(/^.*?tslint/, 'tslint') if runner =~ /^.*tslint/
    puts "running \"#{runner}\" in #{dir}"
    cd dir do
      npm_install if runner =~ /ng\s+lint/
      stdout, stderr, status = Open3.capture3(runner)
      errors << [stdout.strip, stderr.strip].join('\n') if status.exitstatus != 0
      if include_tsc_checks
        stdout, stderr, status = Open3.capture3('tsc --noEmit -p .')
        errors << [stdout.strip, stderr.strip].join('\n') if status.exitstatus != 0
      end
    end
  end
  errors
end

def run_rust_linters
  errors = []
  %w[launcher updater indexer indexer-neon/native].each do |rust_app|
    cd Pathname.new(APPS_DIR).join(rust_app) do
      begin
        sh 'cargo clippy'
      rescue StandardError => e
        errors << e
      end
    end
  end
  errors
end

desc 'lint js code'
task :lint_js do
  errors = run_ts_lint(false)
  es = errors.reduce('') { |acc, e| [acc, e].join('\n') }
  raise es unless errors.empty?
end

desc 'lint rust code'
task :lint_rust do
  errors = run_rust_linters
  es = errors.reduce('') { |acc, e| [acc, e].join('\n') }
  raise es unless errors.empty?
end

# Install standalone plugins
task :install_plugins_standalone
STANDALONE_PLUGINS.each do |p|
  file plugin_bundle_name(p, 'render') do
    install_plugin_standalone(p)
  end
  task install_plugins_standalone: plugin_bundle_name(p, 'render')
end

def install_plugin_standalone(plugin)
  puts "Installing plugin: #{plugin}"
  src = "application/client.plugins.standalone/#{plugin}"
  cd src do
    npm_install
    npm_reinstall('chipmunk.client.toolkit@latest')
    npm_force_resolutions
    sh "#{NPM_RUN} build"
  end
  dest = "#{PLUGINS_SANDBOX}/#{plugin}"
  dest_dist = "#{dest}/render/dist"
  rm_r(dest_dist, force: true)
  cp_r("#{src}/dist", dest_dist, verbose: false)
  cp_r("#{src}/package.json", "#{dest}/render/package.json", verbose: false)
  arch = plugin_bundle_name(plugin, 'render')
  rm(arch, force: true)
  compress_plugin(arch, plugin)
end

task :sign do
  require 'dotenv/load'
  sign_plugin_binary("#{PLUGINS_SANDBOX}/serial/process")
end
def sign_plugin_binary(plugin_path)
  return unless OS.mac?

  if !ENV['SKIP_NOTARIZE'].eql?('true')
    signing_id = ''
    if ENV.key?('SIGNING_ID')
      signing_id = ENV['SIGNING_ID']
    elsif ENV.key?('CHIPMUNK_DEVELOPER_ID')
      signing_id = ENV['CHIPMUNK_DEVELOPER_ID']
    else
      puts 'Cannot sign plugins because cannot find signing_id.'
      puts 'Define it in APPLEID (for production) or in CHIPMUNK_DEVELOPER_ID (for developing)'
      return
    end
    puts "Detected next SIGNING_ID = #{signing_id}\nTry to sign code for: #{plugin_path}"
    full_plugin_path = File.expand_path(plugin_path, File.dirname(__FILE__))
    if ENV.key?('KEYCHAIN_NAME')
      sh "security unlock-keychain -p \"$KEYCHAIN_PWD\" \"$KEYCHAIN_NAME\""
    end
    codesign_execution = "codesign --force --options runtime --deep --sign \"#{signing_id}\" {} \\;"
    sh "find #{full_plugin_path} -name \"*.node\" -type f -exec #{codesign_execution}"
  else
    puts 'Sing binary of plugins will be skipped'
  end
end

def install_plugin_complex(plugin)
  puts "Installing plugin: #{plugin}"
  require 'dotenv/load'
  cd "#{PLUGINS_SANDBOX}/#{plugin}/process" do
    npm_install
    npm_force_resolutions
    npm_install("electron@#{ELECTRON_VERSION} electron-rebuild@#{ELECTRON_REBUILD_VERSION}")
    sh './node_modules/.bin/electron-rebuild'
    sign_plugin_binary("#{PLUGINS_SANDBOX}/#{plugin}/process")
    sh 'npm uninstall electron electron-rebuild'
    sh "#{NPM_RUN} build"
  end
  cd CLIENT_PLUGIN_DIR do
    sh "#{NPM_RUN} build:#{plugin}"
  end
  src = "#{CLIENT_PLUGIN_DIR}/dist/#{plugin}"
  dest_render = "#{PLUGINS_SANDBOX}/#{plugin}/render"
  rm_r(dest_render, force: true)
  cp_r(src.to_s, dest_render, verbose: false)
  compress_plugin(plugin_bundle_name(plugin, 'process'), plugin)
end

# Install complex plugins
task :install_plugins_complex
COMPLEX_PLUGINS.each do |p|
  file plugin_bundle_name(p, 'process') do
    install_plugin_complex(p)
  end
  task install_plugins_complex: plugin_bundle_name(p, 'process')
end

def install_plugin_angular(plugin)
  puts "Installing plugin: #{plugin}"
  cd CLIENT_PLUGIN_DIR do
    sh "#{NPM_RUN} build:#{plugin}"
  end
  src = "#{CLIENT_PLUGIN_DIR}/dist/#{plugin}"
  dest = "#{PLUGINS_SANDBOX}/#{plugin}"
  dest_render = "#{dest}/render"
  rm_r(dest_render, force: true)
  cp_r(src.to_s, dest_render, verbose: false)
  arch = plugin_bundle_name(plugin, 'render')
  compress_plugin(arch, plugin)
end

# desc "Install render (angular) plugins"
task :install_plugins_angular
ANGULAR_PLUGINS.each do |p|
  file plugin_bundle_name(p, 'render') do
    install_plugin_angular(p)
  end
  task install_plugins_angular: plugin_bundle_name(p, 'render')
end

# update plugin.ipc
task :updatepluginipc do
  cd "#{PLUGINS_SANDBOX}/dlt/process" do
    puts 'Update toolkits for: dlt plugin'
    npm_reinstall('chipmunk.plugin.ipc@latest')
  end
  cd "#{PLUGINS_SANDBOX}/serial/process" do
    puts 'Update toolkits for: serial plugin'
    npm_reinstall('chipmunk.plugin.ipc@latest')
  end
  cd "#{PLUGINS_SANDBOX}/processes/process" do
    puts 'Update toolkits for: processes pluginplugin'
    npm_reinstall('chipmunk.plugin.ipc@latest')
  end
  cd "#{PLUGINS_SANDBOX}/xterminal/process" do
    puts 'Update toolkits for: xterminal plugin'
    sh 'npm uninstall chipmunk.plugin.ipc'
    npm_install('chipmunk.plugin.ipc@latest')
  end
end

desc 'build updater'
task build_updater: :folders do
  build_and_deploy_rust_app('updater')
end

desc 'build launcher'
task build_launcher: :folders do
  build_and_deploy_rust_app('launcher')
end

def build_and_deploy_rust_app(name)
  cd "#{APPS_DIR}/#{name}" do
    puts "Build #{name}"
    sh 'cargo build --release'
  end
  rust_exec = rust_exec_in_build_dir(name)
  deployed_app = deployed_rust_exec(name)
  puts "Check old version of app: #{deployed_app}"
  rm(deployed_app, force: true)
  puts "Updating app from: #{rust_exec}"
  cp(rust_exec, deployed_app)
end

def fresh_folder(dest_folder)
  puts "creating folder #{dest_folder}" unless Dir.exist?(dest_folder)
  rm_r(dest_folder, force: true, verbose: true)
  mkdir_p(dest_folder, verbose: true)
end

local_neon_installation = "#{APPS_DIR}/indexer-neon/node_modules/.bin"
# make sure we update if json config files change => compare date of node_modules
file local_neon_installation => FileList['application/electron/*.json'] do |_t|
  puts "NPM isn't installed in project application/electron. Installing..."
  cd "#{APPS_DIR}/indexer-neon" do
    npm_install
    npm_force_resolutions
    touch 'node_modules'
  end
end

task :compile_neon_ts do
  cd "#{APPS_DIR}/indexer-neon" do
    sh "#{NPM_RUN} build-ts-neon"
  end
end
desc 'build embedded indexer'
task build_embedded_indexer: [local_neon_installation, :compile_neon_ts] do
  cd "#{APPS_DIR}/indexer-neon" do
    if OS.windows?
      sh 'node_modules/.bin/electron-build-env neon build --release'
    else
      sh 'node_modules/.bin/electron-build-env node_modules/.bin/neon build --release'
    end
  end
end

def copy_neon_indexer(dest)
  src_folder = "#{APPS_DIR}/indexer-neon"
  dest_folder = "#{dest}/indexer-neon"
  fresh_folder(dest_folder)
  Dir["#{src_folder}/*"]
    .reject { |n| n.end_with?('node_modules') || n.end_with?('native') }
    .each do |s|
    cp_r(s, dest_folder, verbose: true)
  end
  dest_native = "#{dest_folder}/native"
  dest_native_release = "#{dest_native}/target/release"
  fresh_folder(dest_native_release)
  ['artifacts.json', 'index.node'].each do |f|
    cp_r("#{src_folder}/native/#{f}", dest_native, verbose: true)
  end
  neon_resources = Dir.glob("#{src_folder}/native/target/release/*")
                      .reject { |f| f.end_with?('build') || f.end_with?('deps') }
  puts "copying neon-resources to #{dest_native_release}"
  neon_resources.each do |r|
    cp_r(r, dest_native_release, verbose: true)
  end
end

def packaged_neon_dest
  if OS.mac?
    "#{ELECTRON_RELEASE_DIR}/mac/chipmunk.app/Contents/Resources/app/node_modules"
  elsif OS.linux?
    "#{ELECTRON_RELEASE_DIR}/linux-unpacked/resources/app/node_modules"
  else
    "#{ELECTRON_RELEASE_DIR}/win-unpacked/resources/app/node_modules"
  end
end

# put the neon library in place
task :delivery_embedded_into_local_runtime do
  copy_neon_indexer("#{ELECTRON_DIR}/node_modules")
end

desc 'build native parts'
task native: %i[build_launcher
                build_updater]

task :create_release_file_list do
  puts 'Prepare list of files/folders in release'
  if OS.mac?
    puts 'No need to do it for mac'
    next
  elsif OS.linux?
    path = "#{ELECTRON_RELEASE_DIR}/linux-unpacked"
  else
    path = "#{ELECTRON_RELEASE_DIR}/win-unpacked"
  end
  abort("No release found at #{path}") unless File.exist?(path)
  destfile = "#{path}/.release"
  rm(destfile, force: true)
  lines = ".release\n"
  Dir.foreach(path) do |entry|
    lines = "#{lines}#{entry}\n" if entry != '.' && entry != '..'
  end
  File.open(destfile, 'a') do |line|
    line.puts lines
  end
end

def do_create_release(versioner)
  require 'highline'
  cli = HighLine.new
  cli.choose do |menu|
    default = :minor
    menu.prompt = "this will create and tag a new version (default: #{default}) "
    menu.choice(:minor) do
      create_and_tag_new_version(versioner, :minor)
    end
    menu.choice(:major) do
      create_and_tag_new_version(versioner, :major)
    end
    menu.choice(:patch) do
      create_and_tag_new_version(versioner, :patch)
    end
    menu.choice(:abort) { cli.say('ok...maybe later') }
    menu.default = default
  end
end

desc 'create new version and release'
task :create_release do
  current_tag = `git describe --tags`
  versioner = Versioner.for(:package_json, ELECTRON_DIR)
  current_electron_app_version = versioner.get_current_version
  unless current_tag.start_with?(current_electron_app_version)
    raise "current tag #{current_tag} does not match with current electron app version: #{current_electron_app_version}"
  end
  do_create_release(versioner)
end
# same task but do not check previous version
task :create_release_f do
  versioner = Versioner.for(:package_json, ELECTRON_DIR)
  do_create_release(versioner)
end

def create_and_tag_new_version(versioner, jump)
  current_version = versioner.get_current_version
  next_version = versioner.get_next_version(jump)
  assert_tag_exists(current_version)
  create_changelog(current_version, next_version)
  versioner.increment_version(jump)
  sh 'git add .'
  sh "git commit -m \"[](chore): version bump from #{current_version} => #{next_version}\""
  sh "git tag #{next_version}"
  puts 'to undo the last commit and the tag, execute:'
  puts "git reset --hard HEAD~1 && git tag -d #{next_version}"
end

def app_path_in_electron_dist(file_name)
  app_folder_and_path(ELECTRON_RELEASE_DIR, file_name)[1]
end

def build_app_folder_and_path(file_name)
  app_folder_and_path(APPS_DIR, file_name)
end

def app_folder_and_path(base, file_name)
  if OS.mac?
    folder = "#{base}/mac/chipmunk.app/Contents/MacOS"
    path = "#{folder}/#{file_name}"
  elsif OS.linux?
    folder = "#{base}/linux-unpacked"
    path = "#{folder}/#{file_name}"
  else
    folder = "#{base}/win-unpacked"
    path = "#{folder}/#{file_name}.exe"
  end
  [folder, path]
end

def package_version
  package = JSON.parse(File.read(APP_PACKAGE_JSON))
  package['version']
end
# setup file dependencies for chipmunk.client.components installation
electron_build_output = "#{ELECTRON_RELEASE_DIR}/chipmunk-#{package_version}-#{target_platform_alias}.zip"
file electron_build_output => FileList["#{ELECTRON_DIR}/src/**/*.*",
                                       "#{ELECTRON_DIR}/scripts/**/*.*",
                                       "#{ELECTRON_DIR}/*.json"] do |_t|
  require 'dotenv/load'
  cd ELECTRON_DIR do
    sh 'tsc -p tsconfig.json'
    sh "tsc -p #{File.join('scripts', 'tsconfig.json')}"
    if OS.mac?
      begin
        if ENV.key?('APPLEID') && ENV.key?('APPLEIDPASS')
          sh 'export CSC_IDENTITY_AUTO_DISCOVERY=true; npm run build-mac'
          check_signature('dist/release/mac/chipmunk.app')
          if !ENV.key?('SKIP_NOTARIZE')
            check_notarization('dist/release/mac/chipmunk.app')
          end
        else
          sh 'npm run build-mac -c.mac.identity=null'
        end
      rescue LoadError
        sh 'npm run build-mac -c.mac.identity=null'
      end
    elsif OS.linux?
      sh 'npm run build-linux'
    else # windows
      electron_builder_exe = File.join('node_modules', '.bin', 'electron-builder')
      sh "#{electron_builder_exe} --win"
    end
  end
end

def check_signature(path)
  puts 'checking signature'
  sh "codesign -vvv --deep --strict #{path}"
end

def check_notarization(path)
  puts 'checking notarization'
  sh "spctl -vvv --assess --type exec #{path}"
end

desc 'check signature and notarization of mac app'
task :check_mac_deliverable do
  if OS.mac?
    check_signature("#{ELECTRON_RELEASE_DIR}/mac/chipmunk.app")
    check_notarization("#{ELECTRON_RELEASE_DIR}/mac/chipmunk.app")
  end
end

desc 'package electron'
task build_and_package_electron: electron_build_output

desc 'Prepare package to deploy on Github'
task :prepare_to_deploy do
  release_name = "chipmunk@#{package_version}-#{target_platform_name}-portable"
  cd ELECTRON_RELEASE_DIR do
    if OS.mac?
      release_name += ".tgz"
      cd 'mac' do
        sh "tar -czf ../#{release_name} ./chipmunk.app"
      end
    elsif OS.linux?
      release_name += ".tgz"
      cd "#{target_platform_alias}-unpacked" do
        sh "tar -czf ../#{release_name} *"
      end
    else
      release_name += ".zip"
      cd "#{target_platform_alias}-unpacked" do
        sh "powershell -command \"Compress-Archive * ..\\#{release_name}\""
      end
    end
  end
  mv "#{ELECTRON_RELEASE_DIR}/#{release_name}", '.'
end

desc 'developer job to completely build chipmunk...after that use :start'
task dev: %i[install
             plugins
             ripgrepdelivery
             add_package_json]

desc 'Build the full build pipeline for a given platform'
task full_pipeline: %i[check_environment
                       setup_environment
                       install
                       plugins
                       ripgrepdelivery
                       build_and_package_electron
                       create_release_file_list
                       prepare_to_deploy]

desc 'find duplicate files in workspace'
task :dups do
  require 'digest'
  require 'set'
  mapping = {}
  Dir['application/**/*.{ts}']
    .reject { |f| File.directory?(f) || f =~ /node_modules|application\/apps|\.d\.ts/ }
    .each do |f|
    md5 = Digest::MD5.hexdigest File.read f
    print '.'
    STDOUT.flush
    if mapping.key?(md5)
      old = mapping[md5]
      mapping[md5] = old.add f
    else
      mapping[md5] = Set[f]
    end
  end
  puts ''
  mapping.each do |_k, v|
    next unless v.length > 1

    puts '*** duplicated entries:'
    v.to_a.each do |e|
      puts "\t#{e}"
    end
  end
end
