
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
    sh "mkdir ./dist/compiled/plugins & exit 0"
    sh "mkdir ./dist/compiled/client & exit 0"
  end
  cd "application" do
    sh "jake client:all --skip-npm"
    sh "jake electron:quick --skip-npm"
  end
end

desc "install plugins"
task :installplugins do
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
