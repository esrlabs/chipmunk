
require 'fileutils'
require 'json'

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
PATHS_TO_BE_CHECKED = [DIST_FOLDER, COMPILED_FOLDER, RELEASE_FOLDER, INCLUDED_PLUGINS_FOLDER, INCLUDED_APPS_FOLDER] 

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

$task_folders_puts = false

def compress_plugin(file, dest)
  case TARGET_PLATFORM_ALIAS
    when "mac"
      sh "tar -cvzf #{file} -C #{PLUGINS_SANDBOX} #{dest} "
    when "linux"
      sh "tar -cvzf #{file} -C #{PLUGINS_SANDBOX} #{dest} "
    when "win"
      sh "tar -cvzf #{file} -C #{PLUGINS_SANDBOX} #{dest} --force-local"
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

desc "start"
task :start do
  cd "application/electron" do
    sh "npm run electron"
  end
end

desc "prepare"
task :prepare do
  puts "Installing npm libs, which is needed for installing / updateing process"
  sh "npm install typescript --global"
end

desc "folders"
task :folders do
  i = 0;
  while i < PATHS_TO_BE_CHECKED.length
    path = PATHS_TO_BE_CHECKED[i]
    if $task_folders_puts == false
      puts "Check / create folder: #{path}"
    end
    Dir.mkdir(path) unless File.exists?(path)
    i += 1
  end
  $task_folders_puts = true
  Rake::Task["folders"].reenable
end

desc "install"
task :install do
  Rake::Task["folders"].invoke
  cd "application" do
    puts "Installing: root"
    sh "npm install"
  end
  cd "application/client.core" do
    puts "Installing: core"
    sh "npm install"
    sh "npm uninstall logviewer.client.toolkit"
    sh "npm install logviewer.client.toolkit@latest"
  end
  cd "application/client.libs/logviewer.client.components" do
    puts "Installing: components"
    sh "npm install"
  end
  cd "application/client.plugins" do
    puts "Installing: plugins env"
    sh "npm install"
    sh "npm uninstall logviewer.client.toolkit"
    sh "npm install logviewer.client.toolkit@latest"
  end
  cd "application/electron" do
    puts "Installing: electron"
    sh "npm install"
    sh "npm run build-ts"
  end
  Rake::Task["ipc"].invoke
  Rake::Task["clientlibsbuild"].invoke
  Rake::Task["clientlibsdelivery"].invoke
  Rake::Task["clientbuild"].invoke
  Rake::Task["apppackagedelivery"].invoke
end

desc "ipc"
task :ipc do
  puts "Delivery IPC definitions"
  $paths = [DEST_CLIENT_HOST_IPC, DEST_CLIENT_PLUGIN_IPC, DEST_PLUGINIPCLIG_PLUGIN_IPC];
  i = 0;
  while i < $paths.length
    path = $paths[i]
    FileUtils.rm_r(path) unless !File.exists?(path)
    i += 1
  end
  FileUtils.cp_r(SRC_HOST_IPC, DEST_CLIENT_HOST_IPC)
  FileUtils.cp_r(SRC_PLUGIN_IPC, DEST_CLIENT_PLUGIN_IPC)
  FileUtils.cp_r(SRC_PLUGIN_IPC, DEST_PLUGINIPCLIG_PLUGIN_IPC)
end

desc "Building client libs"
task :clientlibsbuild do
  puts "Building client libs"
  cd SRC_CLIENT_NPM_LIBS do
    i = 0;
    while i < CLIENT_NPM_LIBS_NAMES.length
      lib = CLIENT_NPM_LIBS_NAMES[i]
      puts "Compiling client components library: #{lib}"
      sh "npm run build:#{lib}"
      i += 1
    end
  end
end

desc "Delivery client libs"
task :clientlibsdelivery do
  puts "Delivery client libs"
  DESTS_CLIENT_NPM_LIBS
  i = 0;
  while i < DESTS_CLIENT_NPM_LIBS.length
    dest = DESTS_CLIENT_NPM_LIBS[i]
    puts "Delivery libs into: #{dest}"
    j = 0;
    while j < CLIENT_NPM_LIBS_NAMES.length
      lib = CLIENT_NPM_LIBS_NAMES[j]
      src = "#{SRC_CLIENT_NPM_LIBS}/dist/#{lib}"
      path = "#{dest}/#{lib}"
      FileUtils.rm_r(path) unless !File.exists?(path)
      FileUtils.cp_r(src, path)
      j += 1
    end
    i += 1
  end
end

desc "Build client"
task :clientbuild do
  cd "application/client.core" do
    puts "Building client.core"
    sh "npm run build"
  end
  puts "Delivery client.core"
  dest_client_path = "#{COMPILED_FOLDER}/client"
  FileUtils.rm_r(dest_client_path) unless !File.exists?(dest_client_path)
  FileUtils.cp_r(COMPILED_CLIENT_FOLDER, dest_client_path)
end

desc "Add package.json to compiled app"
task :apppackagedelivery do
  FileUtils.cp_r(APP_PACKAGE_JSON, "#{COMPILED_FOLDER}/package.json")
end

desc "install plugins"
task :plugins do
  puts "Drop included plugins: #{INCLUDED_PLUGINS_FOLDER}"
  FileUtils.rm_r(INCLUDED_PLUGINS_FOLDER) unless !File.exists?(INCLUDED_PLUGINS_FOLDER)
  Rake::Task["folders"].invoke
  Rake::Task["pluginsstandalone"].invoke
  Rake::Task["pluginscomplex"].invoke
  Rake::Task["pluginsangular"].invoke
end

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
      sh "npm install"
      sh "npm uninstall logviewer.client.toolkit"
      sh "npm install logviewer.client.toolkit@latest"
      sh "npm run build"
    end
    dest = "#{PLUGINS_SANDBOX}/#{plugin}"
    FileUtils.rm_r("#{dest}/render/dist") unless !File.exists?("#{dest}/render/dist")
    FileUtils.cp_r("#{src}/dist", "#{dest}/render/dist")
    FileUtils.cp_r("#{src}/package.json", "#{dest}/render/package.json")
    package_str = File.read("#{dest}/render/package.json")
    package = JSON.parse(package_str)
    arch = "#{INCLUDED_PLUGINS_FOLDER}/#{plugin}@#{package["version"]}-#{get_nodejs_platform()}.tgz"
    FileUtils.rm(arch) unless !File.exists?(arch)
    compress_plugin(arch, plugin)
    i += 1
  end
end

desc "Install complex plugins"
task :pluginscomplex do
  complex_plugins = ["dlt", "serial", "processes", "xterminal"];
  i = 0
  while i < complex_plugins.length
    plugin = complex_plugins[i]
    puts "Installing plugin: #{plugin}"
    cd "application/sandbox/#{plugin}/process" do
      sh "npm install"
      sh "npm install electron@4.0.3 electron-rebuild@^1.8.2"
      sh "./node_modules/.bin/electron-rebuild"
      sh "npm uninstall electron electron-rebuild"
    end
    cd "application/client.plugins" do
      sh "npm run build:#{plugin}"
    end
    src = "application/client.plugins/dist/#{plugin}"
    dest = "#{PLUGINS_SANDBOX}/#{plugin}"
    FileUtils.rm_r("#{dest}/render") unless !File.exists?("#{dest}/render")
    FileUtils.cp_r("#{src}", "#{dest}/render")
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
      sh "npm run build:#{plugin}"
    end
    src = "application/client.plugins/dist/#{plugin}"
    dest = "#{PLUGINS_SANDBOX}/#{plugin}"
    FileUtils.rm_r("#{dest}/render") unless !File.exists?("#{dest}/render")
    FileUtils.cp_r("#{src}", "#{dest}/render")
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
    sh "npm install logviewer.plugin.ipc@latest"
  end
  cd "application/sandbox/serial/process" do
    puts "Update toolkits for: serial plugin"
    sh "npm uninstall logviewer.plugin.ipc"
    sh "npm install logviewer.plugin.ipc@latest"
  end
  cd "application/sandbox/processes/process" do
    puts "Update toolkits for: xterminal pluginplugin"
    sh "npm uninstall logviewer.plugin.ipc"
    sh "npm install logviewer.plugin.ipc@latest"
  end
  cd "application/sandbox/xterminal/process" do
    puts "Update toolkits for: xterminal plugin"
    sh "npm uninstall logviewer.plugin.ipc"
    sh "npm install logviewer.plugin.ipc@latest"
  end
end


desc "build updater"
task :buildupdater do
  Rake::Task["folders"].invoke

  SRC_APP_DIR = "application/apps/updater/target/release/"
  APP_FILE = "updater"

  if OS.windows? == true
    APP_FILE = "updater.exe"
  end

  cd "application/apps/updater" do
    puts 'Build updater'
    sh "cargo build --release"
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{APP_FILE}"
  FileUtils.rm("#{INCLUDED_APPS_FOLDER}/#{APP_FILE}") unless !File.exists?("#{INCLUDED_APPS_FOLDER}/#{APP_FILE}")
  puts "Updating app from: #{SRC_APP_DIR}#{APP_FILE}"
  FileUtils.cp("#{SRC_APP_DIR}#{APP_FILE}", "#{INCLUDED_APPS_FOLDER}/#{APP_FILE}")

end

desc "build launcher"
task :buildlauncher do
  Rake::Task["folders"].invoke

  SRC_APP_DIR = "application/apps/launcher/target/release/"
  APP_FILE = "launcher"

  if OS.windows? == true
    APP_FILE = "launcher.exe"
  end

  cd "application/apps/launcher" do
    puts 'Build launcher'
    sh "cargo build --release"
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{APP_FILE}"
  FileUtils.rm("#{INCLUDED_APPS_FOLDER}/#{APP_FILE}") unless !File.exists?("#{INCLUDED_APPS_FOLDER}/#{APP_FILE}")
  puts "Updating app from: #{SRC_APP_DIR}#{APP_FILE}"
  FileUtils.cp("#{SRC_APP_DIR}#{APP_FILE}", "#{INCLUDED_APPS_FOLDER}/#{APP_FILE}")

end

desc "build indexer"
task :buildindexer do
  Rake::Task["folders"].invoke

  SRC_APP_DIR = "application/apps/indexer/target/release/"
  APP_FILE_COMP = "indexer_cli"
  APP_FILE_RELEASE = "lvin"

  if OS.windows? == true
    APP_FILE_COMP = "indexer_cli.exe"
    APP_FILE_RELEASE = "lvin.exe"
  end

  cd "application/apps/indexer" do
    puts 'Build indexer'
    sh "cargo build --release"
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{APP_FILE_RELEASE}"
  FileUtils.rm("#{INCLUDED_APPS_FOLDER}/#{APP_FILE_RELEASE}") unless !File.exists?("#{INCLUDED_APPS_FOLDER}/#{APP_FILE_RELEASE}")
  puts "Updating app from: #{SRC_APP_DIR}#{APP_FILE_COMP}"
  FileUtils.cp("#{SRC_APP_DIR}#{APP_FILE_COMP}", "#{INCLUDED_APPS_FOLDER}/#{APP_FILE_RELEASE}")

end

desc "build ripgrep"
task :buildripgrep do
  Rake::Task["folders"].invoke

  SRC_APP_DIR = "application/apps/ripgrep/target/release/"
  APP_FILE = "rg"

  if OS.windows? == true
    APP_FILE = "rg.exe"
  end

  cd "application/apps/ripgrep" do
    puts 'Build ripgrep'
    sh "cargo build --release"
  end

  puts "Check old version of app: #{INCLUDED_APPS_FOLDER}/#{APP_FILE}"
  FileUtils.rm("#{INCLUDED_APPS_FOLDER}/#{APP_FILE}") unless !File.exists?("#{INCLUDED_APPS_FOLDER}/#{APP_FILE}")
  puts "Updating app from: #{SRC_APP_DIR}#{APP_FILE}"
  FileUtils.cp("#{SRC_APP_DIR}#{APP_FILE}", "#{INCLUDED_APPS_FOLDER}/#{APP_FILE}")

end

desc "full update"
task :update => [:buildlauncher, :buildupdater, :buildindexer, :buildripgrep]

desc "build"
task :build do

  FileUtils.rm_r(RELEASE_FOLDER) unless !File.exists?(RELEASE_FOLDER)
  Rake::Task["folders"].invoke

  cd "application/electron" do
    sh "npm run build-ts"
    sh "./node_modules/.bin/build --#{TARGET_PLATFORM_ALIAS}"
  end

  SRC_LAUNCHER = "application/apps/launcher/target/release/launcher"
  RELEASE_PATH = "application/electron/dist/release/"

  case TARGET_PLATFORM_ALIAS
    when "mac"
      FileUtils.mv("#{RELEASE_PATH}mac/chipmunk.app/Contents/MacOS/chipmunk", "#{RELEASE_PATH}mac/chipmunk.app/Contents/MacOS/app")
      FileUtils.cp("#{SRC_LAUNCHER}", "#{RELEASE_PATH}mac/chipmunk.app/Contents/MacOS/chipmunk")
    when "linux"
      FileUtils.mv("#{RELEASE_PATH}linux-unpacked/chipmunk", "#{RELEASE_PATH}linux-unpacked/app")
      FileUtils.cp("#{SRC_LAUNCHER}", "#{RELEASE_PATH}linux-unpacked/chipmunk")
    when "win"
      FileUtils.mv("#{RELEASE_PATH}win-unpacked/chipmunk.exe", "#{RELEASE_PATH}win-unpacked/app.exe")
      FileUtils.cp("#{SRC_LAUNCHER}.exe", "#{RELEASE_PATH}win-unpacked/chipmunk.exe")
  end


end

desc "Prepare package to deploy on Github"
task :prepare_to_deploy do
  puts "Reading package file"
  package_str = File.read(APP_PACKAGE_JSON)
  package = JSON.parse(package_str)
  puts "Detected version: #{package["version"]}"
  cd "application/electron/dist/release" do
    release_name = "chipmunk@#{package["version"]}-#{TARGET_PLATFORM_NAME}-portable"
    case TARGET_PLATFORM_ALIAS
      when "mac"
        cd "mac" do
          sh "tar -cvzf ../#{release_name}.tgz ./chipmunk.app"
        end
      when "linux"
        cd "#{TARGET_PLATFORM_ALIAS}-unpacked" do
          sh "tar -cvzf ../#{release_name}.tgz *"
        end
      when "win"
        cd "#{TARGET_PLATFORM_ALIAS}-unpacked" do
          sh "tar -cvzf ../#{release_name}.tgz ./* --force-local"
        end
    end
  end
end

desc "Build the full build pipeline for a given platform"
task :full_pipeline do
  Rake::Task["prepare"].invoke
  Rake::Task["install"].invoke
  Rake::Task["update"].invoke
  Rake::Task["plugins"].invoke
  Rake::Task["build"].invoke
  Rake::Task["prepare_to_deploy"].invoke
end
