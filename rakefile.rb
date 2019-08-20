
desc "quick build after update"
task :quick do
  cd "application/client.core" do
    sh "npm update logviewer.client.toolkit"
  end
  cd "application" do
    sh "jake client:all --skip-npm"
    sh "jake electron:quick --skip-npm"
  end
  rm_rf "~/.logviewer"
end

desc "start"
task :start do
  cd "application/electron" do
    sh "npm run electron"
  end
end

desc "install"
task :install do
  cd "application" do
    sh "npm install"
  end
  cd "application/client.core" do
    sh "npm install"
  end
  cd "application/client.libs/logviewer.client.components" do
    sh "npm install"
  end
  cd "application/client.plugins" do
    sh "npm install"
  end
  cd "application/electron" do
    sh "npm install"
    sh "npm run build-ts"
    sh "mkdir ./dist/compiled/client & exit 0"
  end
  cd "application" do
    sh "jake client:all --skip-npm"
    sh "jake electron:quick --skip-npm"
  end
  cd "application/electron" do
    sh "mkdir ./dist/compiled/plugins & exit 0"
    sh "mkdir ./dist/release & exit 0"
  end
end

desc "install plugins"
task :installplugins do
  cd "application/electron/dist/compiled/plugins" do
    sh "rm -rf *"
  end
  cd "application/client.plugins.standalone/row.parser.ascii" do
    sh "npm install"
  end
  cd "application/sandbox/dlt/process" do
    sh "npm install"
    sh "npm install electron@4.0.3 electron-rebuild@^1.8.2"
    sh "./node_modules/.bin/electron-rebuild"
    sh "npm uninstall electron electron-rebuild"
  end
  cd "application/sandbox/serial/process" do
    sh "npm install"
    sh "npm install electron@4.0.3 electron-rebuild@^1.8.2"
    sh "./node_modules/.bin/electron-rebuild"
    sh "npm uninstall electron electron-rebuild"
  end
  cd "application/sandbox/processes/process" do
    sh "npm install"
    sh "npm install electron@4.0.3 electron-rebuild@^1.8.2"
    sh "./node_modules/.bin/electron-rebuild"
    sh "npm uninstall electron electron-rebuild"
  end
  cd "application/sandbox/xterminal/process" do
    sh "npm install"
    sh "npm install electron@4.0.3 electron-rebuild@^1.8.2"
    sh "./node_modules/.bin/electron-rebuild"
    sh "npm uninstall electron electron-rebuild"
  end
  cd "application" do
    sh "jake client:all --skip-npm"
    sh "jake plugins:all --skip-npm"
  end
end

desc "update indexer"
task :updateindexer do
  cd "application/electron" do
    sh "npm uninstall logviewer.lvin"
    sh "npm install logviewer.lvin@latest"
  end
end

desc "update toolkit"
task :updatetoolkit do
  cd "application/client.core" do
    sh "npm uninstall logviewer.client.toolkit"
    sh "npm install logviewer.client.toolkit@latest"
  end
  cd "application/client.plugins" do
    sh "npm uninstall logviewer.client.toolkit"
    sh "npm install logviewer.client.toolkit@latest"
  end
  cd "application/client.plugins.standalone/row.parser.ascii" do
    sh "npm uninstall logviewer.client.toolkit"
    sh "npm install logviewer.client.toolkit@latest"
  end
  cd "application" do
    sh "jake client:all --skip-npm"
    sh "jake plugins:all --skip-npm"
    sh "jake electron:quick --skip-npm"
  end
end

desc "full update"
task :update => [:updateindexer, :updatetoolkit]

desc "build"
task :build, [:platform] do |task, args|
  cd "application/electron/dist/release" do
    sh "rm -rf *"
  end
  cd "application/electron" do
    sh "npm run build-ts"
    sh "./node_modules/.bin/build --#{args[:platform]}"
  end
end