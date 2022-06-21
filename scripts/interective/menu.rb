module Screens
  def self.welcome(prompt)
    clear
    choices = [
      { name: 'Build production', value: 1 },
      { name: 'Build developing', value: 2 },
      { name: 'Checks (tests)', value: 3 },
      { name: 'Quality (linting & clippy)', value: 4 },
      { name: 'exit', value: 5 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Screens.build_prod(prompt)
    when 2
      Screens.build_dev(prompt)
    when 3
      Screens.checks(prompt)
    when 4
      Screens.quality(prompt)
    else
      puts 'Goodbuy!'
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
      puts 'Goodbuy!'
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
      puts 'Goodbuy!'
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
      puts 'Goodbuy!'
    end
  end

  def self.tests_list(prompt)
    clear
    puts 'Checks: testing'
    choices = [
      { name: 'Test search [rake test:search]', value: 1 },
      { name: 'Test observe [rake test:observe]', value: 2 },
      { name: 'Test cancel [rake test:cancel]', value: 3 },
      { name: 'back', value: 4 },
      { name: 'exit', value: 5 }
    ]
    case prompt.select('Actions groups', choices)
    when 1
      Rake::Task['test:search'].invoke
    when 2
      Rake::Task['test:observe'].invoke
    when 3
      Rake::Task['test:cancel'].invoke
    when 4
      Screens.checks(prompt)
    else
      puts 'Goodbuy!'
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
      puts 'Goodbuy!'
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
