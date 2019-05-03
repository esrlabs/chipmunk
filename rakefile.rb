require 'rake'

desc "run tests"
task :test do
  sh "cargo test -- --nocapture"
end
