# Stampbench Desktop

The native shell packages the existing local-first Stampbench workbench for Windows and, later, macOS.

## Product workflow

1. Receive one or more UBL or CII XML documents.
2. Inspect them locally with an explicit EN 16931 or XRechnung profile.
3. Resolve source-linked rule findings.
4. Keep the document in the device-local register.
5. Export a timestamped report containing the ruleset version and SHA-256 document fingerprint.
6. Connect an external accounting or delivery provider only after explicit user action.

## Development

Run the web workspace on port 4180, then start Electron:

```powershell
npm run dev -w web -- --port 4180
npm run dev -w @stampbench/desktop
```

## Windows installer

```powershell
npm run dist:win -w @stampbench/desktop
```

The build first creates a credential-free static export containing the desktop route, then packages it inside Electron. The production window serves those files from a loopback-only HTTP server. Node integration is disabled, context isolation and renderer sandboxing are enabled, and external navigation is blocked from the application window.
