require './scripts/env/config'
require './scripts/elements/platform'
module Environment
  @@checked = false

  def self.rust
    config = Config.new
    if config.get_rust_version == 'stable'
      Reporter.skipped('Env', 'Skip checking of rust version for stable', '')
      return
    end
    output = `rustc -V`
    if output.include? config.get_rust_version
      Reporter.skipped('Env', "Target version of rust (#{config.get_rust_version}) already installed", '')
      return
    end
    Shell.sh "rustup install #{config.get_rust_version}"
    Shell.sh "rustup default #{config.get_rust_version}"
    Reporter.done('Env', "Installed rust (#{config.get_rust_version})", '')
  end

  def self.nj_cli
    if system('nj-cli -V')
      Reporter.skipped('Env', 'nj-cli is installed already', '')
      return
    end
    Shell.sh 'cargo install nj-cli'
    Reporter.done('Env', 'nj-cli is installed', '')
  end

  def self.wasm_pack
    if system('wasm-pack --help')
      Reporter.skipped('Env', 'wasm-pack is installed already', '')
      return
    end
    Shell.sh 'cargo install wasm-pack'
    Reporter.done('Env', 'wasm-pack is installed', '')
  end

  def self.yarn
    if system('yarn -v')
      Reporter.skipped('Env', 'yarn is installed already', '')
      return
    end
    Shell.sh 'npm install --global yarn'
    Reporter.done('Env', 'yarn is installed', '')
  end

  def self.list
    Shell.sh 'nj-cli -V'
    Shell.sh 'yarn -v'
    # Shell.sh 'wasm-pack -V'
    Shell.sh 'node -v'
    Shell.sh 'rustc -V'
  end

  def self.check
    return if @@checked
    Environment.rust
    Environment.nj_cli
    Environment.wasm_pack
    Environment.yarn
    Environment.list
    Reporter.done('Env', 'checking envs', '')
    @@checked = true
  end
end
