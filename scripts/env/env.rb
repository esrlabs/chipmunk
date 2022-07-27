module Environment
  def self.rust
    config = Config.new
    if config.get_rust_version == 'stable'
      Reporter.add(Jobs::Skipped, Owner::Env, 'Skip checking of rust version for stable', '')
      return
    end
    output = `rustc -V`
    if output.include? config.get_rust_version
      Reporter.add(Jobs::Skipped, Owner::Env,
                   "Target version of rust (#{config.get_rust_version}) already installed", '')
      return
    end
    Shell.sh "rustup install #{config.get_rust_version}"
    Shell.sh "rustup default #{config.get_rust_version}"
    Reporter.add(Jobs::Install, Owner::Env, "Installed rust (#{config.get_rust_version})", '')
  end

  def self.nj_cli
    if system('nj-cli -V')
      Reporter.add(Jobs::Skipped, Owner::Env, 'nj-cli is installed already', '')
      return
    end
    Shell.sh 'cargo install nj-cli'
    Reporter.add(Jobs::Install, Owner::Env, 'nj-cli is installed', '')
  end

  def self.wasm_pack
    if system('wasm-pack -V')
      Reporter.add(Jobs::Skipped, Owner::Env, 'wasm-pack is installed already', '')
      return
    end
    Shell.sh 'curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh'
    Reporter.add(Jobs::Install, Owner::Env, 'wasm-pack is installed', '')
  end

  def self.check
    Environment.rust
    Environment.nj_cli
    Environment.wasm_pack
  end
end
