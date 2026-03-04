### Making `opencode` run this local fork

Use a compiled local binary as the default setup. This keeps normal `opencode` usage independent of Bun at runtime.

1. Install dependencies for the fork:

```bash
cd /path/to/opencode
bun install
```

2. Build and install the current-platform binary from this checkout:

```bash
bun run install:local-binary
```

This command:

- builds the current-platform executable from `packages/opencode`
- installs it to `~/.opencode/bin/opencode`
- overwrites any existing wrapper script or prior local binary at that path

3. After changing source code in this fork, rebuild and reinstall:

```bash
bun run install:local-binary
```

If you need a baseline x64 build:

```bash
bun run install:local-binary -- --baseline
```

If you previously saved the upstream installed binary as `~/.opencode/bin/opencode.upstream`, you can roll back manually:

```bash
cp ~/.opencode/bin/opencode.upstream ~/.opencode/bin/opencode
chmod 755 ~/.opencode/bin/opencode
```

Legacy fallback:

- The older wrapper-based `bun dev` setup should only be used as a temporary local override.
- The primary supported setup for this fork is the compiled local binary flow above.
