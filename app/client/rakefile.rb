require 'rake/clean'

desc 'build the site'
task :build do
  sh "npm run build"
end

desc 'update from github & install prereqs'
task :update do
  sh "git fetch origin"
  sh "git rebase origin/master"
  sh "npm install"
end

desc 'run install & build'
task :all => [:install, :build]
