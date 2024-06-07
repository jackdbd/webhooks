{
  description = "My webhooks";

  inputs = {
    # https://github.com/NixOS/nixpkgs/branches
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable-small";
    alejandra = {
      url = "github:kamadorueda/alejandra/3.0.0";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    fh.url = "https://flakehub.com/f/DeterminateSystems/fh/*.tar.gz";
    nil.url = "github:oxalica/nil";
  };

  outputs = {
    fh,
    nil,
    nixpkgs,
    self,
    ...
  } @ inputs: let
    overlays = [
      (final: prev: {
        nodejs = prev.nodejs_22;
      })
    ];
    supportedSystems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];
    forEachSupportedSystem = f:
      nixpkgs.lib.genAttrs supportedSystems (system:
        f {
          pkgs = import nixpkgs {
            inherit overlays system;
            config.allowUnfreePredicate = pkg: builtins.elem (nixpkgs.lib.getName pkg) ["ngrok"];
          };
        });
    # Note: in this Nix flake we cannot read files from the secrets directory
    # because they were added to the .gitignore (only secrets/README.md can be
    # read like this).
    # some_secret = builtins.readFile ./secrets/some_secret.json;
    # See here for a longer explanation and a rationale for this behavior:
    # https://discourse.nixos.org/t/readfile-doesnt-find-file/21103/4
    # https://github.com/NixOS/nix/issues/7107
  in {
    devShells = forEachSupportedSystem ({pkgs}: {
      default = pkgs.mkShell {
        packages = with pkgs; [ngrok nodejs nodePackages.wrangler];

        shellHook = ''
          echo "🪝 webhooks dev shell"
          echo "- $(ngrok --version)"
          echo "- Node.js $(node --version)"
          echo "- npm $(npm --version)"
          echo "- wrangler $(wrangler --version)"

          # secrets exposed as environment variables
          export NPM_WEBHOOK_SECRET=$(cat /run/secrets/npm | jq .webhook_secret);
          # export STRIPE_TEST=$(cat /run/secrets/stripe/personal/test);
          # export STRIPE_API_KEY_TEST=$(cat /run/secrets/stripe/personal/test | jq .api_key);
          export TELEGRAM=$(cat /run/secrets/telegram/personal_bot);

          ngrok config add-authtoken $(cat /run/secrets/ngrok/auth_token);
        '';

        DEBUG = "stripe:*";
        PORT = 8788;
        # The webhook target could be one of the following:
        # - http://localhost:8788
        # - ngrok forwarding URL
        # - URL hosted on Cloudflare Pages
        # WEBHOOKS_TARGET = "http://localhost:8788";
        # WEBHOOKS_TARGET = "https://2d32-2001-b07-646b-9c55-5025-4803-6411-46ba.ngrok-free.app";
        # WEBHOOKS_TARGET = "https://d5b6f5ae.webhooks-98q.pages.dev";
        WEBHOOKS_TARGET = "https://webhooks.giacomodebidda.com";
      };
    });
  };
}
