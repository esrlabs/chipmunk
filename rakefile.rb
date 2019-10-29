# frozen_string_literal: true

require 'fileutils'
require 'open-uri'
require 'json'
require 'pathname'
require 'uri'
require 'rake/clean'
require './rake-extensions'

NPM_RUN = 'npm run --quiet'

ELECTRON_DIR = 'application/electron'
ELECTRON_DIST_DIR = "#{ELECTRON_DIR}/dist"
ELECTRON_COMPILED_DIR = "#{ELECTRON_DIST_DIR}/compiled"
ELECTRON_RELEASE_DIR = "#{ELECTRON_DIST_DIR}/release"
APPS_DIR = 'application/apps'
CLIENT_CORE_DIR = 'application/client.core'

INCLUDED_PLUGINS_FOLDER = "#{ELECTRON_COMPILED_DIR}/plugins"
INCLUDED_APPS_FOLDER = "#{ELECTRON_COMPILED_DIR}/apps"
APP_PACKAGE_JSON = "#{ELECTRON_DIR}/package.json"
SRC_CLIENT_NPM_LIBS = 'application/client.libs/chipmunk.client.components'
RIPGREP_URL = 'https://github.com/BurntSushi/ripgrep/releases/download/11.0.2/ripgrep-11.0.2'
RIPGREP_LOCAL_TMP = File.join(Dir.home, 'tmp/ripgrep_download')

DESTS_CLIENT_NPM_LIBS = [
  "#{CLIENT_CORE_DIR}/node_modules",
  'application/client.plugins/node_modules'
].freeze
CLIENT_NPM_LIBS_NAMES = %w[
  chipmunk-client-containers
  chipmunk-client-primitive
  chipmunk-client-complex
].freeze
COMPLEX_PLUGINS = [
  'dlt',
  'serial',
  'processes'
  # "xterminal"
].freeze
ANGULAR_PLUGINS = ['dlt-render'].freeze
STANDALONE_PLUGINS = ['row.parser.ascii'].freeze

PLUGINS_SANDBOX = 'application/sandbox'

directory ELECTRON_DIST_DIR
directory ELECTRON_COMPILED_DIR
directory ELECTRON_RELEASE_DIR
directory INCLUDED_PLUGINS_FOLDER
directory INCLUDED_APPS_FOLDER
directory RIPGREP_LOCAL_TMP

FOLDERS_TO_CLEAN = [
  ELECTRON_DIST_DIR,
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

task folders: [ELECTRON_DIST_DIR,
               ELECTRON_COMPILED_DIR,
               ELECTRON_RELEASE_DIR,
               INCLUDED_PLUGINS_FOLDER,
               INCLUDED_APPS_FOLDER]

SRC_LAUNCHER = "#{APPS_DIR}/launcher/target/release/launcher"

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

def npm_reinstall(package_and_version)
  xs = package_and_version.split('@')
  package = xs[0]
  version = xs[1]
  sh "npm uninstall #{package}"
  sh "npm install #{package}@#{version} --prefere-offline"
end

desc 'start'
task start: :ripgrepdelivery do
  cd ELECTRON_DIR do
    sh "#{NPM_RUN} electron"
  end
end

desc 'setup build environment'
task :setup_environment do
  puts 'Installing npm libs, which is needed for installing / updateing process'
  npm_install('typescript --global')
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
  task :build_core do
    cd CLIENT_CORE_DIR do
      puts 'Installing: core'
      npm_install
      npm_install('chipmunk.client.toolkit@latest')
    end
  end
  task :rebuild_core do
    cd CLIENT_CORE_DIR do
      puts 're-installing: core'
      npm_install
      npm_reinstall('chipmunk.client.toolkit@latest')
    end
  end
  task :build_components do
    cd 'application/client.libs/chipmunk.client.components' do
      puts 'Installing: components'
      npm_install
    end
  end
  task :build_plugins do
    cd 'application/client.plugins' do
      puts 'Installing: plugins env'
      npm_install
      npm_install('chipmunk.client.toolkit@latest')
    end
  end
  task :rebuild_plugins do
    cd 'application/client.plugins' do
      puts 'Re-Installing: plugins env'
      npm_install
      npm_reinstall('chipmunk.client.toolkit@latest')
    end
  end

  task :build_libs do
    puts 'Building client libs'
    cd SRC_CLIENT_NPM_LIBS do
      i = 0
      while i < CLIENT_NPM_LIBS_NAMES.length
        lib = CLIENT_NPM_LIBS_NAMES[i]
        puts "Compiling client components library: #{lib}"
        sh "#{NPM_RUN} build:#{lib}"
        i += 1
      end
    end
  end

  task :deliver_libs do
    puts 'Delivery client libs'
    i = 0
    while i < DESTS_CLIENT_NPM_LIBS.length
      dest = DESTS_CLIENT_NPM_LIBS[i]
      puts "Delivery libs into: #{dest}"
      unless File.exist?(dest)
        puts "NPM isn't installed in project #{File.dirname(dest)}. Installing..."
        cd File.dirname(dest) do
          npm_install
        end
      end
      j = 0
      while j < CLIENT_NPM_LIBS_NAMES.length
        lib = CLIENT_NPM_LIBS_NAMES[j]
        src = "#{SRC_CLIENT_NPM_LIBS}/dist/#{lib}"
        path = "#{dest}/#{lib}"
        puts src
        puts path
        rm_r(path, force: true)
        cp_r(src, path, verbose: false)
        j += 1
      end
      i += 1
    end
  end

  task :build do
    cd CLIENT_CORE_DIR do
      puts 'Building client.core'
      sh "#{NPM_RUN} build"
    end
    puts 'Delivery client.core'
    dest_client_path = "#{ELECTRON_COMPILED_DIR}/client"
    rm_r(dest_client_path, force: true)
    cp_r("#{CLIENT_CORE_DIR}/dist/logviewer", dest_client_path, verbose: false)
  end
end
task compile_electron: [:prepare_electron_build,
                        :native,
                        'dev:neon',
                        :finish_electron_build]
task :prepare_electron_build do
  cd ELECTRON_DIR do
    npm_install
  end
end
task :finish_electron_build do
  cd ELECTRON_DIR do
    sh "#{NPM_RUN} build-ts"
  end
end

desc 're-install'
task reinstall: [:folders,
                 'client:rebuild_core',
                 'client:build_components',
                 :compile_electron,
                 'client:build_libs',
                 'client:deliver_libs',
                 'client:build',
                 :add_package_json]
desc 'install'
task install: [:folders,
               'client:build_core',
               'client:build_components',
               :compile_electron,
               'client:build_libs',
               'client:deliver_libs',
               'client:build',
               :add_package_json]

namespace :dev do

  desc 'Developer task: plugin serial: render'
  task :serial_render do
    install_plugin_angular('serial')
  end

  desc 'Developer task: plugin processes: render'
  task :processes_render do
    install_plugin_angular('processes')
  end

  desc 'Developer task: plugin dlt: render'
  task :dlt_render do
    install_plugin_angular('dlt')
  end

  desc 'Developer task: plugin dlt-render: render'
  task :dltrender_render do
    install_plugin_angular('dlt-render')
  end

  desc 'Developer task: plugin xterminal: render'
  task :xterminal_render do
    install_plugin_angular('xterminal')
  end

  desc 'Developer task: update and delivery indexer-neon'
  task neon: %i[build_embedded_indexer delivery_embedded_indexer_into_app]

  desc 'Developer task: update client'
  task update_client: ['client:build']

  desc 'Developer task: update client and libs'
  task fullupdate_client: ['client:build_libs', 'client:deliver_libs', :update_client]

  desc 'Developer task: update client and run electron'
  task fullupdate_client_run: :fullupdate_client do
    cd ELECTRON_DIR do
      sh "#{NPM_RUN} electron"
    end
  end

  # Application should be built already to use this task
  desc 'Developer task: build launcher and delivery into package.'
  task build_delivery_apps: %i[build_launcher build_updater] do
    if OS.mac?
      node_app_original = "#{ELECTRON_RELEASE_DIR}/mac/chipmunk.app/Contents/MacOS/chipmunk"
      launcher = SRC_LAUNCHER
    elsif OS.linux?
      node_app_original = "#{ELECTRON_RELEASE_DIR}/linux-unpacked/chipmunk"
      launcher = SRC_LAUNCHER
    else
      node_app_original = "#{ELECTRON_RELEASE_DIR}/win-unpacked/chipmunk.exe"
      launcher = "#{SRC_LAUNCHER}.exe"
    end
    rm(node_app_original)
    cp(launcher, node_app_original)
  end
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

def install_plugin_standalone(plugin)
  puts "Installing plugin: #{plugin}"
  src = "application/client.plugins.standalone/#{plugin}"
  cd src do
    npm_install
    npm_reinstall('chipmunk.client.toolkit@latest')
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
    .reject { |f| f =~ /node_modules/ || f =~ %r{dist/compiled} || f =~ %r{sandbox/row\.parser\.ascii} }
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

def run_ts_lint
  require 'open3'
  errors = []
  lint_scripts = collect_ts_lint_scripts
  lint_scripts.each { |s| puts "  * #{s[0]}" }
  lint_scripts.each do |lint|
    dir = lint[0]
    runner = lint[2]
    runner = runner.sub!(/^.*?tslint/, 'tslint') if runner =~ /^.*tslint/
    cd dir do
      npm_install if runner =~ /ng\s+lint/
      stdout, stderr, status = Open3.capture3(runner)
      errors << [stdout.strip, stderr.strip].join('\n') if status.exitstatus != 0
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
  errors = run_ts_lint
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

def install_plugin_complex(plugin)
  puts "Installing plugin: #{plugin}"
  cd "#{PLUGINS_SANDBOX}/#{plugin}/process" do
    npm_install
    npm_install('electron@6.0.12 electron-rebuild@^1.8.6')
    sh './node_modules/.bin/electron-rebuild'
    sh 'npm uninstall electron electron-rebuild'
    sh "#{NPM_RUN} build"
  end
  cd 'application/client.plugins' do
    sh "#{NPM_RUN} build:#{plugin}"
  end
  src = "application/client.plugins/dist/#{plugin}"
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
  cd 'application/client.plugins' do
    sh "#{NPM_RUN} build:#{plugin}"
  end
  src = "application/client.plugins/dist/#{plugin}"
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
    npm_reinstall('logviewer.plugin.ipc@latest')
  end
  cd "#{PLUGINS_SANDBOX}/serial/process" do
    puts 'Update toolkits for: serial plugin'
    npm_reinstall('logviewer.plugin.ipc@latest')
  end
  cd "#{PLUGINS_SANDBOX}/processes/process" do
    puts 'Update toolkits for: processes pluginplugin'
    npm_reinstall('logviewer.plugin.ipc@latest')
  end
  # cd "#{PLUGINS_SANDBOX}/xterminal/process" do
  #  puts "Update toolkits for: xterminal plugin"
  #  sh "npm uninstall logviewer.plugin.ipc"
  #  npm_install("logviewer.plugin.ipc@latest")
  # end
end

desc 'build updater'
task build_updater: :folders do
  src_app_dir = "#{APPS_DIR}/updater/target/release/"
  app_file = 'updater'

  app_file = 'updater.exe' if OS.windows? == true

  cd "#{APPS_DIR}/updater" do
    puts 'Build updater'
    sh 'cargo build --release'
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{app_file}"
  rm("#{INCLUDED_APPS_FOLDER}/#{app_file}", force: true)
  puts "Updating app from: #{src_app_dir}#{app_file}"
  cp("#{src_app_dir}#{app_file}", "#{INCLUDED_APPS_FOLDER}/#{app_file}")
end

desc 'build launcher'
task build_launcher: :folders do
  src_app_dir = "#{APPS_DIR}/launcher/target/release/"
  app_file = 'launcher'

  app_file = 'launcher.exe' if OS.windows? == true

  cd "#{APPS_DIR}/launcher" do
    puts 'Build launcher'
    sh 'cargo build --release'
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{app_file}"
  rm("#{INCLUDED_APPS_FOLDER}/#{app_file}", force: true)
  puts "Updating app from: #{src_app_dir}#{app_file}"
  cp("#{src_app_dir}#{app_file}", "#{INCLUDED_APPS_FOLDER}/#{app_file}")
end

desc 'build indexer'
task build_indexer: :folders do
  src_app_dir = "#{APPS_DIR}/indexer/target/release/"
  app_file_comp = 'indexer_cli'
  app_file_release = 'lvin'

  if OS.windows? == true
    app_file_comp = 'indexer_cli.exe'
    app_file_release = 'lvin.exe'
  end

  cd "#{APPS_DIR}/indexer" do
    puts 'Build indexer'
    sh 'cargo build --release'
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{app_file_release}"
  rm("#{INCLUDED_APPS_FOLDER}/#{app_file_release}", force: true)
  puts "Updating app from: #{src_app_dir}#{app_file_comp}"
  cp("#{src_app_dir}#{app_file_comp}", "#{INCLUDED_APPS_FOLDER}/#{app_file_release}")
end

def fresh_folder(dest_folder)
  rm_r(dest_folder, force: true)
  mkdir_p dest_folder
end

def package_and_copy_neon_indexer(dest)
  src_folder = "#{APPS_DIR}/indexer-neon"
  dest_folder = "#{dest}/indexer-neon"
  puts "Deliver indexer from: #{src_folder} into #{dest_folder}"
  fresh_folder(dest_folder)
  Dir["#{src_folder}/*"]
    .reject { |n| n.end_with?('node_modules') || n.end_with?('native') }
    .each do |s|
    cp_r(s, dest_folder, verbose: true)
  end
  dest_native = "#{dest_folder}/native"
  dest_native_release = "#{dest_native}/target/release"
  fresh_folder(dest_native_release)
  ['Cargo.lock', 'Cargo.toml', 'artifacts.json', 'build.rs', 'index.node', 'src'].each do |f|
    cp_r("#{src_folder}/native/#{f}", dest_native, verbose: true)
  end
  neon_resources = Dir.glob("#{src_folder}/native/target/release/*")
                      .reject { |f| f.end_with?('build') || f.end_with?('deps') }
  cp_r(neon_resources, dest_native_release)
end

desc 'build embedded indexer'
task :build_embedded_indexer do
  cd "#{APPS_DIR}/indexer-neon" do
    npm_install
    sh "#{NPM_RUN} build-ts-neon"
    sh 'node_modules/.bin/electron-build-env neon build --release'
  end
end

task :neon_indexer_delivery do
  dest = if OS.mac?
           "#{ELECTRON_RELEASE_DIR}/mac/chipmunk.app/Contents/Resources/app/node_modules"
         elsif OS.linux?
           "#{ELECTRON_RELEASE_DIR}/linux-unpacked/resources/app/node_modules"
         else
           "#{ELECTRON_RELEASE_DIR}/win-unpacked/resources/app/node_modules"
         end
  package_and_copy_neon_indexer(dest)
end

desc 'put the neon library in place'
task :delivery_embedded_indexer_into_app do
  package_and_copy_neon_indexer("#{ELECTRON_DIR}/node_modules")
end

desc 'build native parts'
task native: %i[build_launcher
                build_updater
                build_indexer]

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

desc 'create new version and release'
task :create_release do
  current_tag = `git describe --tags`
  versioner = Versioner.for(:package_json, ELECTRON_DIR)
  current_electron_app_version = versioner.get_current_version
  unless current_tag.start_with?(current_electron_app_version)
    raise "current tag #{current_tag} does not match with current electron app version: #{current_electron_app_version}"
  end

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

desc 'package electron'
task assemble_build: :folders do
  cd ELECTRON_DIR do
    sh "#{NPM_RUN} build-ts"
    sh "./node_modules/.bin/electron-builder --#{target_platform_alias}"
  end
  if OS.mac?
    app_dir = "#{ELECTRON_RELEASE_DIR}/mac/chipmunk.app/Contents/MacOS"
    mv("#{app_dir}/chipmunk", "#{app_dir}/app")
    cp(SRC_LAUNCHER.to_s, "#{app_dir}/chipmunk")
  elsif OS.linux?
    app_dir = "#{ELECTRON_RELEASE_DIR}/linux-unpacked"
    mv("#{app_dir}/chipmunk", "#{app_dir}/app")
    cp(SRC_LAUNCHER.to_s, "#{app_dir}/chipmunk")
  else
    app_dir = "#{ELECTRON_RELEASE_DIR}/win-unpacked"
    mv("#{app_dir}/chipmunk.exe", "#{app_dir}/app.exe")
    cp("#{SRC_LAUNCHER}.exe", "#{app_dir}/chipmunk.exe")
  end
end

desc 'Prepare package to deploy on Github'
task :prepare_to_deploy do
  package = JSON.parse(File.read(APP_PACKAGE_JSON))
  puts "Detected version: #{package['version']}"
  release_name = "chipmunk@#{package['version']}-#{target_platform_name}-portable.tgz"
  cd ELECTRON_RELEASE_DIR do
    if OS.mac?
      cd 'mac' do
        sh "tar -czf ../#{release_name} ./chipmunk.app"
      end
    elsif OS.linux?
      cd "#{target_platform_alias}-unpacked" do
        sh "tar -czf ../#{release_name} *"
      end
    else
      cd "#{target_platform_alias}-unpacked" do
        sh "tar -czf ../#{release_name} ./* --force-local"
      end
    end
  end
  mv "#{ELECTRON_RELEASE_DIR}/#{release_name}", '.'
end

desc 'developer job to completely build chipmunk...after that use :start'
task dev: %i[install
             plugins
             ripgrepdelivery
             assemble_build
             neon_indexer_delivery]

desc 'Build the full build pipeline for a given platform'
task full_pipeline: %i[setup_environment
                       install
                       plugins
                       ripgrepdelivery
                       assemble_build
                       neon_indexer_delivery
                       create_release_file_list
                       prepare_to_deploy]

desc 'find duplicate files in workspace'
task :dups do
  require 'digest'
  require 'set'
  mapping = {}
  Dir['./**/*.*']
    .reject { |f| File.directory?(f) }
    .each do |f|
    md5 = Digest::MD5.hexdigest File.read f
    if mapping.key?(md5)
      old = mapping[md5]
      mapping[md5] = old.add f
    else
      mapping[md5] = Set[f]
    end
  end
  mapping.each do |_k, v|
    next unless v.length > 1

    puts '*** duplicated entries:'
    v.to_a.each do |e|
      puts e
    end
  end
end
task :a do
  puts RIPGREP_LOCAL_TMP
  puts 'a'
  sleep(0.6)
end
task b: :a do
  puts 'b'
  sleep(0.5)
end
task c: :b do
  puts 'c'
  sleep(0.1)
end
