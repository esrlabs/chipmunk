module Screens
  def self.welcome(prompt)
    clear
    choices = [
      { name: 'Build production', value: 1 },
      { name: 'Build developing', value: 2 },
      { name: 'Developing shortcuts', value: 3 },
      { name: 'Checks (tests)', value: 4 },
      { name: 'Quality (linting & clippy)', value: 5 },
      { name: 'Release', value: 6 },
      { name: 'exit', value: 7 }
    ]
    puts '=' * 100
    puts "\e[32mWelcome to Chipmunk builder\e[0m"
    puts "\e[32mNo verbose mode: #{ENV['CHIPMUNK_BUILD_VERBOSE_HIDE']} (export CHIPMUNK_BUILD_VERBOSE_HIDE=true/false)\e[0m"
    puts '=' * 100
    puts ''
    case prompt.select('Actions groups', choices)
    when 1
      Screens.build_prod(prompt)
    when 2
      Screens.build_dev(prompt)
    when 3
      Screens.dev_shortcuts(prompt)
    when 4
      Screens.checks(prompt)
    when 5
      Screens.quality(prompt)
    when 6
      Screens.release(prompt)
    else
      puts 'Goodbye!'
    end
  end

  def self.build_prod(prompt)
    clear
    puts 'Building in PRODUCTION mode'
    choices = [
      { name: 'Build solution [rake build:prod]', value: 1 },
      { name: 'Build & delivery bindings [rake build:bindings]', value: 2 },
      { name: 'Build & delivery client [rake build:client_prod]', value: 3 },
      { name: 'back', value: 4 },
      { name: 'exit', value: 5 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['build:prod'].invoke
    when 2
      Rake::Task['build:bindings'].invoke
    when 3
      Rake::Task['build:client_prod'].invoke
    when 4
      Screens.welcome(prompt)
    else
      puts 'Goodbye!'
    end
  end

  def self.release(prompt)
    clear
    puts 'Creating a release'
    choices = [
      { name: 'Create developing release [rake release:dev]', value: 1 },
      { name: 'Create production release [rake release:prod]', value: 2 },
      { name: 'back', value: 3 },
      { name: 'exit', value: 4 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['release:dev'].invoke
    when 2
      Rake::Task['release:prod'].invoke
    when 3
      Screens.welcome(prompt)
    else
      puts 'Goodbye!'
    end
  end

  def self.build_dev(prompt)
    clear
    puts 'Building in DEVELOPING mode'
    choices = [
      { name: 'Build solution [rake build:dev]', value: 1 },
      { name: 'Build & delivery bindings [rake build:bindings]', value: 2 },
      { name: 'Build & delivery client [rake build:client_dev]', value: 3 },
      { name: 'back', value: 4 },
      { name: 'exit', value: 5 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['build:dev'].invoke
    when 2
      Rake::Task['build:bindings'].invoke
    when 3
      Rake::Task['build:client_dev'].invoke
    when 4
      Screens.welcome(prompt)
    else
      puts 'Goodbye!'
    end
  end

  def self.dev_shortcuts(prompt)
    clear
    puts 'Some shortcuts for developing process'
    choices = [
      { name: 'Rebuild client (dev) and delivery [rake developing:client]', value: 1 },
      { name: 'Recompile rs-bindings and rebuild ts-bindings [rake developing:bindings]', value: 2 },
      { name: 'Rebuild holder [rake developing:holder]', value: 3 },
      { name: 'Rebuild holder (+ bindings) [rake developing:holder_bindings]', value: 4 },
      { name: 'Rebuild holder (+ platform) [rake developing:holder_platform]', value: 5 },
      { name: 'Rebuild holder (+ platform + bindings) [rake developing:holder_platform_bindings]', value: 6 },
      { name: 'Build matcher [rake build:matcher]', value: 7 },
      { name: 'Build updater [rake build:updater]', value: 8 },
      { name: 'Build utils [rake build:utils]', value: 9 },
      { name: 'Clean everything', value: 10 },
      { name: 'Clean & Rebuild everything', value: 11 },
      { name: 'back', value: 12 },
      { name: 'exit', value: 13 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['developing:client'].invoke
    when 2
      Rake::Task['developing:bindings'].invoke
    when 3
      Rake::Task['developing:holder'].invoke
    when 4
      Rake::Task['developing:holder_bindings'].invoke
    when 5
      Rake::Task['developing:holder_platform'].invoke
    when 6
      Rake::Task['developing:holder_platform_bindings'].invoke
    when 7
      Rake::Task['build:matcher'].invoke
    when 8
      Rake::Task['build:updater'].invoke
    when 9
      Rake::Task['build:utils'].invoke
    when 10
      Rake::Task['developing:clean_all'].invoke
    when 11
      Rake::Task['developing:clean_rebuild_all'].invoke
    when 12
      Screens.welcome(prompt)
    else
      puts 'Goodbye!'
    end
  end

  def self.checks(prompt)
    clear
    puts 'Checks: testing'
    choices = [
      { name: 'All bindings tests [rake test:all]', value: 1 },
      { name: 'List of bindings tests', value: 2 },
      { name: 'back', value: 3 },
      { name: 'exit', value: 4 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['test:all'].invoke
    when 2
      Screens.tests_list(prompt)
    when 3
      Screens.welcome(prompt)
    else
      puts 'Goodbye!'
    end
  end

  def self.tests_list(prompt)
    clear
    puts 'Checks: testing'
    choices = [
      { name: 'Test binding search [rake test:binding:search]', value: 1 },
      { name: 'Test binding observe [rake test:binding:observe]', value: 2 },
      { name: 'Test binding concat [rake test:binding:concat]', value: 3 },
      { name: 'Test binding extract [rake test:binding:extract]', value: 4 },
      { name: 'Test binding exporting [rake test:binding:exporting]', value: 5 },
      { name: 'Test binding ranges [rake test:binding:ranges]', value: 6 },
      { name: 'Test binding cancel [rake test:binding:cancel]', value: 7 },
      { name: 'Test binding errors [rake test:binding:errors]', value: 8 },
      { name: 'Test binding map [rake test:binding:map]', value: 9 },
      { name: 'Test matcher karma [rake test:matcher:karma]', value: 10 },
      { name: 'Test matcher rust [rake test:matcher:rust', value: 11 },
      { name: 'Test utils karma [rake test:utils:karma]', value: 12},
      { name: 'Test utils rust [rake test:utils:rust]', value: 13},
      { name: 'Test all [rake test:all', value: 14 },
      { name: 'back', value: 15 },
      { name: 'exit', value: 16 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['test:binding:search'].invoke
    when 2
      Rake::Task['test:binding:observe'].invoke
    when 3
      Rake::Task['test:binding:concat'].invoke
    when 4
      Rake::Task['test:binding:extract'].invoke
    when 5
      Rake::Task['test:binding:exporting'].invoke
    when 6
      Rake::Task['test:binding:ranges'].invoke
    when 7
      Rake::Task['test:binding:cancel'].invoke
    when 8
      Rake::Task['test:binding:errors'].invoke
    when 9
      Rake::Task['test:binding:map'].invoke
    when 10
      Rake::Task['test:matcher:karma'].invoke
    when 11
      Rake::Task['test:matcher:rust'].invoke
    when 12
      Rake::Task['test:utils:karma'].invoke
    when 13
      Rake::Task['test:utils:rust'].invoke
    when 14
      Rake::Task['test:all'].invoke
    when 15
      Screens.checks(prompt)
    else
      puts 'Goodbye!'
    end
  end

  def self.quality(prompt)
    clear
    puts 'Checks: testing'
    choices = [
      { name: 'Lint & Clippy', value: 1 },
      { name: 'Lint [rake lint:all]', value: 2 },
      { name: 'Clippy [rake clippy:all]', value: 3 },
      { name: 'back', value: 4 },
      { name: 'exit', value: 5 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['lint:all'].invoke
      Rake::Task['clippy:all'].invoke
    when 2
      Rake::Task['lint:all'].invoke
    when 3
      Rake::Task['clippy:all'].invoke
    when 4
      Screens.welcome(prompt)
    else
      puts 'Goodbye!'
    end
  end
end

def renderInterectiveMenu
  require 'tty-prompt'
  prompt = TTY::Prompt.new
  Screens.welcome(prompt)
end

def clear
  system 'clear'
  system 'cls'
end
