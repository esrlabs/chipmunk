NJ = 'nj-cli'

task :build do
  sh "#{NJ} build"
end
task :build_release do
  sh "#{NJ} build --release"
end

desc 'test'
task :test => :build do
  sh 'node test/test.js'
end

desc 'test_release'
task :test_release => :build_release do
  sh 'node test/test.js'
end
