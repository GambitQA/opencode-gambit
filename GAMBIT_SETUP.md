### Making `opencode` run this local fork

If you want the `opencode` command in your shell to launch this checkout's dev build, replace the installed binary with a small wrapper script.

This repo includes support for `OPENCODE_CWD` in `packages/opencode/src/index.ts`, which lets the wrapper start from the repo root for Bun resolution and then restore the caller's original working directory before the CLI runs.

1. Install dependencies for the fork:

```bash
cd /path/to/opencode
bun install
```

2. Back up your currently installed binary:

```bash
mv ~/.opencode/bin/opencode ~/.opencode/bin/opencode.upstream
```

3. Replace `~/.opencode/bin/opencode` with this wrapper:

```sh
#!/bin/sh

if [ "${OPENCODE_USE_UPSTREAM:-}" = "1" ]; then
  exec "$HOME/.opencode/bin/opencode.upstream" "$@"
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "opencode: bun is required to run the local dev fork" >&2
  exit 1
fi

if [ ! -f /path/to/opencode/packages/opencode/src/index.ts ]; then
  echo "opencode: local fork entrypoint not found at /path/to/opencode/packages/opencode/src/index.ts" >&2
  exit 1
fi

cwd="${PWD:-$(pwd)}"

cd /path/to/opencode || exit 1

if [ "$#" -eq 0 ]; then
  exec env OPENCODE_CWD="$cwd" bun run dev
fi

exec env OPENCODE_CWD="$cwd" bun run dev -- "$@"
```

4. Make it executable:

```bash
chmod +x ~/.opencode/bin/opencode
```

After this, running `opencode` anywhere will launch this local checkout's `bun run dev`.

Useful notes:

- No rebuild is required for normal development. Edit code, then run `opencode` again.
- `OPENCODE_USE_UPSTREAM=1 opencode ...` bypasses the wrapper and runs the original installed binary.
- This wrapper assumes your shell already has `~/.opencode/bin` in `PATH`.

To roll back:

```bash
rm ~/.opencode/bin/opencode
mv ~/.opencode/bin/opencode.upstream ~/.opencode/bin/opencode
```

If you want to build a fresh native binary from this fork instead of using the wrapper:

```bash
cd packages/opencode
bun run build -- --single
```

That writes a platform-specific binary to `packages/opencode/dist/<target>/bin/opencode`.

To install that compiled binary:

```bash
cd /path/to/opencode
./install --binary /path/to/opencode/packages/opencode/dist/<target>/bin/opencode --no-modify-path
```

Installing a compiled binary this way overwrites the wrapper, so use one workflow or the other.
