{
  description = "Chipmunk: fast desktop viewer for log files";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      forAllSystems = function:
        nixpkgs.lib.genAttrs systems (system: function nixpkgs.legacyPackages.${system});
      # winit and glutin load these with dlopen, so no linker records them.
      # The OpenGL driver itself comes from the host (NixOS, or a nixGL wrapper elsewhere).
      runtimeLibraries = pkgs: [
        pkgs.libglvnd
        pkgs.libxkbcommon
        pkgs.wayland
        pkgs.libx11
        pkgs.libxcursor
        pkgs.libxi
        pkgs.libxrandr
      ];
    in {
      packages = forAllSystems (pkgs:
        let
          isLinux = pkgs.stdenv.hostPlatform.isLinux;
        in {
          default = pkgs.rustPlatform.buildRustPackage {
            pname = "chipmunk";
            version = (pkgs.lib.importTOML ./Cargo.toml).workspace.package.version;
            src = self;
            cargoLock = {
              lockFile = ./Cargo.lock;
              # egui, someip and someip-payload are git dependencies pinned by revision.
              allowBuiltinFetchGit = true;
            };
            cargoBuildFlags = [ "--package" "app" ];
            # The check phase would compile and run the tests of the whole workspace.
            doCheck = false;
            nativeBuildInputs = [ pkgs.pkg-config ];
            # openssl: native-tls of reqwest; udev: serial port discovery.
            buildInputs = [ pkgs.openssl ] ++ pkgs.lib.optionals isLinux [ pkgs.udev ];
            postInstall = pkgs.lib.optionalString isLinux ''
              install -D --mode=644 crates/app/data/linux/chipmunk.desktop --target-directory=$out/share/applications
              for icon in crates/app/data/icons/png/[0-9]*.png; do
                size=$(basename $icon .png)
                install -D --mode=644 $icon $out/share/icons/hicolor/''${size}x''${size}/apps/chipmunk.png
              done
            '';
            # Run path instead of LD_LIBRARY_PATH: the variable would leak into the commands chipmunk spawns.
            postFixup = pkgs.lib.optionalString isLinux ''
              patchelf --add-rpath ${pkgs.lib.makeLibraryPath (runtimeLibraries pkgs)} $out/bin/chipmunk
            '';
            meta = {
              description = "Fast desktop viewer for log files of any size";
              homepage = "https://github.com/esrlabs/chipmunk";
              license = pkgs.lib.licenses.asl20;
              mainProgram = "chipmunk";
            };
          };
        });
    };
}
