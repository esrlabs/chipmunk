
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
