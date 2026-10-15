{
  description = "Chipmunk development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
      ];
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          # The Rust toolchain is expected from rustup, so the shell only adds
          # native libraries.
          default = pkgs.mkShell {
            nativeBuildInputs = [ pkgs.pkg-config ];
            buildInputs = with pkgs; [
              openssl
              systemd # libudev for serialport
            ];

            # winit, x11rb, and glutin load these with dlopen at runtime.
            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath (
              with pkgs;
              [
                wayland
                libxkbcommon
                libx11
                libxcb
                libxcursor
                libxi
                libxrandr
                libGL
              ]
            );
          };
        }
      );
    };
}
