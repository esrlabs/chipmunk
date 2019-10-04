require 'fileutils'
require 'json'
require 'open-uri'
require 'benchmark'
require 'pathname'
require 'uri'
require 'rake/clean'

module OS
  def OS.windows?
    (/cygwin|mswin|mingw|bccwin|wince|emx/ =~ RUBY_PLATFORM) != nil
  end

  def OS.mac?
   (/darwin/ =~ RUBY_PLATFORM) != nil
  end

  def OS.unix?
    !OS.windows?
  end

  def OS.linux?
    OS.unix? and not OS.mac?
  end

  def OS.jruby?
    RUBY_ENGINE == 'jruby'
  end
end

NPM_RUN = "npm run --quiet"
DIST_FOLDER = "application/electron/dist"
COMPILED_CLIENT_FOLDER = "application/client.core/dist/logviewer"
COMPILED_FOLDER = "application/electron/dist/compiled"
RELEASE_FOLDER = "application/electron/dist/release"
INCLUDED_PLUGINS_FOLDER = "application/electron/dist/compiled/plugins"
INCLUDED_APPS_FOLDER = "application/electron/dist/compiled/apps"
APP_PACKAGE_JSON = "application/electron/package.json"
SRC_HOST_IPC = "application/electron/src/controllers/electron.ipc.messages"
DEST_CLIENT_HOST_IPC = "application/client.core/src/app/environment/services/electron.ipc.messages"
SRC_PLUGIN_IPC = "application/electron/src/controllers/plugins.ipc.messages"
DEST_CLIENT_PLUGIN_IPC = "application/client.core/src/app/environment/services/plugins.ipc.messages"
DEST_PLUGINIPCLIG_PLUGIN_IPC = "application/node.libs/logviewer.plugin.ipc/src/ipc.messages"
SRC_CLIENT_NPM_LIBS = "application/client.libs/logviewer.client.components"
RIPGREP_URL = "https://github.com/BurntSushi/ripgrep/releases/download/11.0.2/ripgrep-11.0.2"
DESTS_CLIENT_NPM_LIBS = [
  "application/client.core/node_modules",
  "application/client.plugins/node_modules"
]
CLIENT_NPM_LIBS_NAMES = [
  "logviewer-client-containers",
  "logviewer-client-primitive",
  "logviewer-client-complex",
]
PLUGINS_SANDBOX = "application/sandbox"

directory DIST_FOLDER
directory COMPILED_FOLDER
directory RELEASE_FOLDER
directory INCLUDED_PLUGINS_FOLDER
directory INCLUDED_APPS_FOLDER

FOLDERS_TO_CLEAN = [DIST_FOLDER, COMPILED_FOLDER, RELEASE_FOLDER, INCLUDED_PLUGINS_FOLDER, INCLUDED_APPS_FOLDER]
CLEAN.include(FOLDERS_TO_CLEAN)
task :rust_clean do
  ["launcher", "updater", "indexer"].each do |rust_app|
    cd Pathname.new("application/apps").join(rust_app) do
      sh "cargo clean"
    end
  end
end

task :clean => :rust_clean
CLOBBER.include(["**/node_modules", "**/package-lock.json", "**/dist", "application/apps/indexer/target"])

task :folders => [DIST_FOLDER, COMPILED_FOLDER, RELEASE_FOLDER, INCLUDED_PLUGINS_FOLDER, INCLUDED_APPS_FOLDER]

SRC_LAUNCHER = "application/apps/launcher/target/release/launcher"
RELEASE_PATH = "application/electron/dist/release/"

if OS.windows? == true
  TARGET_PLATFORM_NAME = "win64"
  TARGET_PLATFORM_ALIAS = "win"
elsif OS.mac? == true
  TARGET_PLATFORM_NAME = "darwin"
  TARGET_PLATFORM_ALIAS = "mac"
else
  TARGET_PLATFORM_NAME = "linux"
  TARGET_PLATFORM_ALIAS = "linux"
end

puts "Detected target platform is: #{TARGET_PLATFORM_NAME} / #{TARGET_PLATFORM_ALIAS}"

def compress_plugin(file, dest)
  case TARGET_PLATFORM_ALIAS
    when "mac"
      sh "tar -czf #{file} -C #{PLUGINS_SANDBOX} #{dest} "
    when "linux"
      sh "tar -czf #{file} -C #{PLUGINS_SANDBOX} #{dest} "
    when "win"
      sh "tar -czf #{file} -C #{PLUGINS_SANDBOX} #{dest} --force-local"
  end
end

def get_nodejs_platform()
  platform_tag = ""
  if OS.windows? == true
    platform_tag = "win32"
  elsif OS.mac? == true
    platform_tag = "darwin"
  else
    platform_tag = "linux"
  end
  return platform_tag
end
def npm_install(what = "")
  sh "npm install #{what} --prefere-offline"
end

desc "start"
task :start do
  cd "application/electron" do
    sh "#{NPM_RUN} electron"
  end
end

desc "setup build environment"
task :setup_environment do
  puts "Installing npm libs, which is needed for installing / updateing process"
  npm_install("typescript --global")
  if OS.windows?
    File.open(File.join(Dir.home, ".cargo").join("config"), "a") do |f|
      f.puts ""
      ["[target.'cfg(windows)']",
      'rustflags = ["-C", "link-args=/DELAYLOAD:node.exe /INCLUDE:__pfnDliNotifyHook2 delayimp.lib"]'].each { |line| f.puts(line) }
    end
  end
end

desc "ripgrep delivery"
task :ripgrepdelivery => :folders do
  path = "temp"
  Dir.mkdir(path) unless File.exists?(path)
  case TARGET_PLATFORM_ALIAS
    when "mac"
      url = "#{RIPGREP_URL}-x86_64-apple-darwin.tar.gz"
    when "linux"
      url = "#{RIPGREP_URL}-x86_64-unknown-linux-musl.tar.gz"
    when "win"
      url = "#{RIPGREP_URL}-x86_64-pc-windows-msvc.zip"
  end
  file_name = URI(url).path.split('/').last
  unix_version_platform = File.basename(file_name, ".tar.gz")

  open("#{path}/#{file_name}", "wb") do |file|
    file << open(url).read
  end
  case TARGET_PLATFORM_ALIAS
    when "mac"
      cd path do
        sh "tar xvzf #{file_name}"
      end
      src = "#{path}/#{unix_version_platform}/rg"
      dest = "#{COMPILED_FOLDER}/apps/rg"
    when "linux"
      cd path do
        sh "tar xvzf #{file_name}"
      end
      src = "#{path}/#{unix_version_platform}/rg"
      dest = "#{COMPILED_FOLDER}/apps/rg"
    when "win"
      cd path do
        sh "unzip #{file_name}"
      end
      src = "#{path}/rg.exe"
      dest = "#{COMPILED_FOLDER}/apps/rg.exe"
  end
  rm(dest, :force => true)
  cp(src, dest)
  rm_r(path, :force => true)
end

task :build_client_core do
  cd "application/client.core" do
    puts "Installing: core"
    npm_install
    sh "npm uninstall logviewer.client.toolkit"
    npm_install("logviewer.client.toolkit@latest")
  end
end
task :build_client_components do
  cd "application/client.libs/logviewer.client.components" do
    puts "Installing: components"
    npm_install
  end
end
task :build_client_plugins do
  cd "application/client.plugins" do
    puts "Installing: plugins env"
    npm_install
    sh "npm uninstall logviewer.client.toolkit"
    npm_install("logviewer.client.toolkit@latest")
  end
end
task :build_electron => [ :prepare_electron_build,
                          :native,
                          :delivery_embedded_indexer_into_app,
                          :finish_electron_build]
task :prepare_electron_build do
  cd "application/electron" do
    npm_install
  end
end
task :finish_electron_build do
  cd "application/electron" do
    sh "#{NPM_RUN} build-ts"
  end
end

desc "install"
task :install => [:folders,
                  :build_client_core,
                  :build_client_components,
                  :build_electron,
                  :ipc,
                  :clientlibsbuild,
                  :clientlibsdelivery,
                  :client_build,
                  :apppackagedelivery,
]

desc "Developer task: update and delivery indexer-neon"
task :dev_update_and_delivery_indexer => [:build_embedded_indexer, :delivery_embedded_indexer_into_app]

desc "Developer task: update application with indexer-neon"
task :dev_update_application_with_indexer => [:dev_update_and_delivery_indexer, :start]

desc "Developer task: update client"
task :dev_update_client => [:ipc, :client_build]

desc "Developer task: update client"
task :dev_fullupdate_client => [:clientlibsbuild, :clientlibsdelivery, :dev_update_client]

desc "Developer task: update client"
task :dev_fullupdate_client_run => :dev_fullupdate_client do
  cd "application/electron" do
    sh "#{NPM_RUN} electron"
  end
end

#Application should be built already to use this task
desc "Developer task: build launcher and delivery into package."
task :dev_build_delivery_apps => [:build_launcher, :build_updater] do
  case TARGET_PLATFORM_ALIAS
    when "mac"
      node_app_original = "#{RELEASE_PATH}mac/chipmunk.app/Contents/MacOS/chipmunk"
      launcher = SRC_LAUNCHER
    when "linux"
      node_app_original = "#{RELEASE_PATH}linux-unpacked/chipmunk"
      launcher = SRC_LAUNCHER
    when "win"
      node_app_original = "#{RELEASE_PATH}win-unpacked/chipmunk.exe"
      launcher = "#{SRC_LAUNCHER}.exe"
  end
  rm(node_app_original)
  cp(launcher, node_app_original)
end

desc "ipc"
task :ipc do
  puts "Delivery IPC definitions"
  $paths = [DEST_CLIENT_HOST_IPC, DEST_CLIENT_PLUGIN_IPC, DEST_PLUGINIPCLIG_PLUGIN_IPC];
  i = 0;
  while i < $paths.length
    path = $paths[i]
    rm_r(path, :force => true)
    i += 1
  end
  cp_r(SRC_HOST_IPC, DEST_CLIENT_HOST_IPC, :verbose => false)
  cp_r(SRC_PLUGIN_IPC, DEST_CLIENT_PLUGIN_IPC, :verbose => false)
  cp_r(SRC_PLUGIN_IPC, DEST_PLUGINIPCLIG_PLUGIN_IPC, :verbose => false)
end

desc "Building client libs"
task :clientlibsbuild do
  puts "Building client libs"
  cd SRC_CLIENT_NPM_LIBS do
    i = 0;
    while i < CLIENT_NPM_LIBS_NAMES.length
      lib = CLIENT_NPM_LIBS_NAMES[i]
      puts "Compiling client components library: #{lib}"
      sh "#{NPM_RUN} build:#{lib}"
      i += 1
    end
  end
end

desc "Delivery client libs"
task :clientlibsdelivery do
  puts "Delivery client libs"
  i = 0;
  while i < DESTS_CLIENT_NPM_LIBS.length
    dest = DESTS_CLIENT_NPM_LIBS[i]
    puts "Delivery libs into: #{dest}"
    if !File.exists?(dest)
      puts "NPM isn't installed in project #{File.dirname(dest)}. Installing..."
      cd File.dirname(dest) do
        npm_install
      end
    end
    j = 0;
    while j < CLIENT_NPM_LIBS_NAMES.length
      lib = CLIENT_NPM_LIBS_NAMES[j]
      src = "#{SRC_CLIENT_NPM_LIBS}/dist/#{lib}"
      path = "#{dest}/#{lib}"
      puts src
      puts path
      rm_r(path, :force => true)
      cp_r(src, path, :verbose => false)
      j += 1
    end
    i += 1
  end
end

desc "Build client"
task :client_build do
  cd "application/client.core" do
    puts "Building client.core"
    sh "#{NPM_RUN} build"
  end
  puts "Delivery client.core"
  dest_client_path = "#{COMPILED_FOLDER}/client"
  rm_r(dest_client_path, :force => true)
  cp_r(COMPILED_CLIENT_FOLDER, dest_client_path, :verbose => false)
end

desc "Add package.json to compiled app"
task :apppackagedelivery do
  cp_r(APP_PACKAGE_JSON, "#{COMPILED_FOLDER}/package.json", :verbose => false)
end

desc "install plugins"
task :plugins => [:folders, :pluginsstandalone, :pluginscomplex, :pluginsangular]

desc "Install standalone plugins"
task :pluginsstandalone do
  complex_plugins = ["row.parser.ascii"];
  i = 0
  while i < complex_plugins.length
    plugin = complex_plugins[i]
    puts "Installing plugin: #{plugin}"
    src = "application/client.plugins.standalone/#{plugin}"
    cd src do
      puts "Install plugin: #{plugin}"
      npm_install
      sh "npm uninstall logviewer.client.toolkit"
      npm_install("logviewer.client.toolkit@latest")
      sh "#{NPM_RUN} build"
    end
    dest = "#{PLUGINS_SANDBOX}/#{plugin}"
    dest_dist = "#{dest}/render/dist"
    rm_r(dest_dist, :force => true)
    cp_r("#{src}/dist", dest_dist, :verbose => false)
    cp_r("#{src}/package.json", "#{dest}/render/package.json", :verbose => false)
    package_str = File.read("#{dest}/render/package.json")
    package = JSON.parse(package_str)
    arch = "#{INCLUDED_PLUGINS_FOLDER}/#{plugin}@#{package["version"]}-#{get_nodejs_platform()}.tgz"
    rm(arch, :force => true)
    compress_plugin(arch, plugin)
    i += 1
  end
end

desc "Install complex plugins"
task :pluginscomplex do
  complex_plugins = [
    "dlt",
    "serial",
    "processes" ,
    #"xterminal"
  ];
  i = 0
  while i < complex_plugins.length
    plugin = complex_plugins[i]
    puts "Installing plugin: #{plugin}"
    cd "application/sandbox/#{plugin}/process" do
      npm_install
      npm_install("electron@6.0.11 electron-rebuild@^1.8.6")
      sh "./node_modules/.bin/electron-rebuild"
      sh "npm uninstall electron electron-rebuild"
      sh "#{NPM_RUN} build"
    end
    cd "application/client.plugins" do
      sh "#{NPM_RUN} build:#{plugin}"
    end
    src = "application/client.plugins/dist/#{plugin}"
    dest = "#{PLUGINS_SANDBOX}/#{plugin}"
    dest_render = "#{dest}/render"
    rm_r(dest_render, :force => true)
    cp_r("#{src}", dest_render, :verbose => false)
    package_str = File.read("#{dest}/process/package.json")
    package = JSON.parse(package_str)
    arch = "#{INCLUDED_PLUGINS_FOLDER}/#{plugin}@#{package["version"]}-#{get_nodejs_platform()}.tgz"
    compress_plugin(arch, plugin)
    i += 1
  end
end

desc "Install render (angular) plugins"
task :pluginsangular do
  complex_plugins = ["dlt-render"];
  i = 0
  while i < complex_plugins.length
    plugin = complex_plugins[i]
    puts "Installing plugin: #{plugin}"
    cd "application/client.plugins" do
      sh "#{NPM_RUN} build:#{plugin}"
    end
    src = "application/client.plugins/dist/#{plugin}"
    dest = "#{PLUGINS_SANDBOX}/#{plugin}"
    dest_render = "#{dest}/render"
    rm_r(dest_render, :force => true)
    cp_r("#{src}", dest_render, :verbose => false)
    package_str = File.read("#{dest}/render/package.json")
    package = JSON.parse(package_str)
    arch = "#{INCLUDED_PLUGINS_FOLDER}/#{plugin}@#{package["version"]}-#{get_nodejs_platform()}.tgz"
    compress_plugin(arch, plugin)
    i += 1
  end
end

desc "update plugin.ipc"
task :updatepluginipc do
  cd "application/sandbox/dlt/process" do
    puts "Update toolkits for: dlt plugin"
    sh "npm uninstall logviewer.plugin.ipc"
    npm_install("logviewer.plugin.ipc@latest")
  end
  cd "application/sandbox/serial/process" do
    puts "Update toolkits for: serial plugin"
    sh "npm uninstall logviewer.plugin.ipc"
    npm_install("logviewer.plugin.ipc@latest")
  end
  cd "application/sandbox/processes/process" do
    puts "Update toolkits for: processes pluginplugin"
    sh "npm uninstall logviewer.plugin.ipc"
    npm_install("logviewer.plugin.ipc@latest")
  end
  #cd "application/sandbox/xterminal/process" do
  #  puts "Update toolkits for: xterminal plugin"
  #  sh "npm uninstall logviewer.plugin.ipc"
  #  npm_install("logviewer.plugin.ipc@latest")
  #end
end

desc "build updater"
task :build_updater => :folders do

  src_app_dir = "application/apps/updater/target/release/"
  app_file = "updater"

  if OS.windows? == true
    app_file = "updater.exe"
  end

  cd "application/apps/updater" do
    puts 'Build updater'
    sh "cargo build --release"
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{app_file}"
  rm("#{INCLUDED_APPS_FOLDER}/#{app_file}", :force => true)
  puts "Updating app from: #{src_app_dir}#{app_file}"
  cp("#{src_app_dir}#{app_file}", "#{INCLUDED_APPS_FOLDER}/#{app_file}")

end

desc "build launcher"
task :build_launcher => :folders do
  src_app_dir = "application/apps/launcher/target/release/"
  app_file = "launcher"

  if OS.windows? == true
    app_file = "launcher.exe"
  end

  cd "application/apps/launcher" do
    puts 'Build launcher'
    sh "cargo build --release"
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{app_file}"
  rm("#{INCLUDED_APPS_FOLDER}/#{app_file}", :force => true)
  puts "Updating app from: #{src_app_dir}#{app_file}"
  cp("#{src_app_dir}#{app_file}", "#{INCLUDED_APPS_FOLDER}/#{app_file}")

end

desc "build indexer"
task :build_indexer => :folders do

  src_app_dir = "application/apps/indexer/target/release/"
  app_file_comp = "indexer_cli"
  app_file_release = "lvin"

  if OS.windows? == true
    app_file_comp = "indexer_cli.exe"
    app_file_release = "lvin.exe"
  end

  cd "application/apps/indexer" do
    puts 'Build indexer'
    sh "cargo build --release"
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{app_file_release}"
  rm("#{INCLUDED_APPS_FOLDER}/#{app_file_release}", :force => true)
  puts "Updating app from: #{src_app_dir}#{app_file_comp}"
  cp("#{src_app_dir}#{app_file_comp}", "#{INCLUDED_APPS_FOLDER}/#{app_file_release}")

end

def fresh_folder(dest_folder)
  rm_r(dest_folder, :force => true)
  mkdir_p dest_folder
end

def delivery_embedded_indexer(dest)
  src_folder = Pathname.new("application/apps/indexer-neon")
  dest_folder = Pathname.new(dest).join("indexer-neon")
  puts "Delivery indexer from: #{src_folder} into #{dest_folder}"
  fresh_folder(dest_folder)
  Dir[src_folder.join "*"]
    .reject { |n| n.end_with? "node_modules" or n.end_with? "native" }
    .each do |s|
      cp_r(s, dest_folder, :verbose => false)
  end
  dest_native = dest_folder.join("native")
  dest_native_target = dest_native.join("target")
  fresh_folder(dest_native_target)
  ["Cargo.lock", "Cargo.toml", "artifacts.json", "build.rs", "index.node", "src"].each do |f|
    cp_r(src_folder.join("native").join(f), dest_native, :verbose => false)
  end
  cp_r(src_folder.join("native").join("target").join("release"), dest_native_target, :verbose => false)
end

desc "build embedded indexer"
task :build_embedded_indexer do
  cd "application/apps/indexer-neon" do
    npm_install
    sh "#{NPM_RUN} build"
  end
end

task :delivery_embedded_indexer_into_release do
  case TARGET_PLATFORM_ALIAS
    when "mac"
      dest = "#{RELEASE_PATH}mac/chipmunk.app/Contents/Resources/app/node_modules"
    when "linux"
      dest = "#{RELEASE_PATH}linux-unpacked/resources/app/node_modules"
    when "win"
      dest = "#{RELEASE_PATH}win-unpacked/resources/app/node_modules"
  end
  delivery_embedded_indexer(dest)
end

desc "put the neon library in place"
task :delivery_embedded_indexer_into_app do
  delivery_embedded_indexer("application/electron/node_modules")
end

desc "build native parts"
task :native => [ :build_launcher,
                  :build_updater,
                  :build_indexer,
                  :build_embedded_indexer]

desc "create list of files and folder in release"
task :setlistofreleasefiles do
  puts "Prepare list of files/folders in release"
  case TARGET_PLATFORM_ALIAS
    when "mac"
      puts "No need to do it for mac"
      next
    when "linux"
      path = "#{RELEASE_FOLDER}/linux-unpacked"
    when "win"
      path = "#{RELEASE_FOLDER}/win-unpacked"
  end
  if !File.exists?(path)
    abort("No release found at #{path}")
  end
  destfile = "#{path}/.release"
  rm(destfile, :force => true)
  lines = ".release\n";
  Dir.foreach(path) {|entry|
    if entry != "." && entry != ".."
      lines = "#{lines}#{entry}\n"
    end
  }
  File.open(destfile, "a") do |line|
    line.puts lines
  end
end

desc "build"
task :build => :folders do
  cd "application/electron" do
    sh "#{NPM_RUN} build-ts"
    sh "./node_modules/.bin/electron-builder --#{TARGET_PLATFORM_ALIAS}"
  end

  case TARGET_PLATFORM_ALIAS
    when "mac"
      mv("#{RELEASE_PATH}mac/chipmunk.app/Contents/MacOS/chipmunk", "#{RELEASE_PATH}mac/chipmunk.app/Contents/MacOS/app")
      cp("#{SRC_LAUNCHER}", "#{RELEASE_PATH}mac/chipmunk.app/Contents/MacOS/chipmunk")
    when "linux"
      mv("#{RELEASE_PATH}linux-unpacked/chipmunk", "#{RELEASE_PATH}linux-unpacked/app")
      cp("#{SRC_LAUNCHER}", "#{RELEASE_PATH}linux-unpacked/chipmunk")
    when "win"
      mv("#{RELEASE_PATH}win-unpacked/chipmunk.exe", "#{RELEASE_PATH}win-unpacked/app.exe")
      cp("#{SRC_LAUNCHER}.exe", "#{RELEASE_PATH}win-unpacked/chipmunk.exe")
  end

end

desc "Prepare package to deploy on Github"
task :prepare_to_deploy do
  puts "===== prepare_to_deploy"
  time = Benchmark.measure do
    package_str = File.read(APP_PACKAGE_JSON)
    package = JSON.parse(package_str)
    puts "Detected version: #{package["version"]}"
    cd "application/electron/dist/release" do
      release_name = "chipmunk@#{package["version"]}-#{TARGET_PLATFORM_NAME}-portable"
      case TARGET_PLATFORM_ALIAS
        when "mac"
          cd "mac" do
            sh "tar -czf ../#{release_name}.tgz ./chipmunk.app"
          end
        when "linux"
          cd "#{TARGET_PLATFORM_ALIAS}-unpacked" do
            sh "tar -czf ../#{release_name}.tgz *"
          end
        when "win"
          cd "#{TARGET_PLATFORM_ALIAS}-unpacked" do
            sh "tar -czf ../#{release_name}.tgz ./* --force-local"
          end
      end
    end
  end
  puts "prepare_to_deploy took #{time}"
end

desc "Build the full build pipeline for a given platform"
task :full_pipeline => [:setup_environment,
                        :clean,
                        :install,
                        :plugins,
                        :ripgrepdelivery,
                        :build,
                        :delivery_embedded_indexer_into_release,
                        :setlistofreleasefiles,
                        :prepare_to_deploy]

$task_benchmarks = []

class Rake::Task
  def execute_with_benchmark(*args)
    puts "******* running task #{name}"
    bm = Benchmark.realtime { execute_without_benchmark(*args) }
    $task_benchmarks << [name, bm]
    puts ">>>>>>>    #{name} --> #{'%.1f' % bm} s"
  end

  alias_method :execute_without_benchmark, :execute
  alias_method :execute, :execute_with_benchmark
end

task :a do
  puts "a"
  sleep(0.6)
end
task :b => :a do
  puts "b"
  sleep(0.5)
end
task :c => :b do
  puts "c"
  sleep(0.1)
end

at_exit do
  total_time = $task_benchmarks.reduce(0) {|acc, x| acc + x[1]}
  $task_benchmarks
    .sort { |a, b| b[1] <=> a[1] }
    .each do |res|
    percentage = res[1]/total_time * 100
    if percentage.round > 0
      percentage_bar = ""
      percentage.round.times { percentage_bar += "|" }
      puts "#{percentage_bar} (#{'%.1f' % percentage} %) #{res[0]} ==> #{'%.1f' % res[1]}s"
    end
  end
  puts "total time was: #{'%.1f' % total_time}"
end

