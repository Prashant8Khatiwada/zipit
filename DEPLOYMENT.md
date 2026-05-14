# ZipIt Deployment Guide 🚀

This document outlines the process for releasing new versions of the ZipIt packages to the NPM registry.

## 1. Authentication
Ensure you are logged into NPM with an account that has permission to publish to the `@khatiwadaprashant` scope.

```bash
npm login
```

## 2. Preparing a Release (Standard Flow)

We use **Changesets** to manage versions and changelogs automatically.

### Step A: Create a Changeset
Whenever you make a change that warrants a version bump, run:
```bash
npx changeset
```
- Select which packages changed (`core`, `react`, or both).
- Choose the bump type (`patch`, `minor`, or `major`).
- Enter a brief description of the change.

### Step B: Versioning
When you are ready to release all accumulated changes:
```bash
npx changeset version
```
This will:
1. Bump the versions in `package.json`.
2. Update the `CHANGELOG.md` files in each package.
3. Commit these changes (if configured).

## 3. Publishing to NPM

### Step A: Build the Project
Ensure all packages are compiled and type-checked:
```bash
pnpm run build
pnpm run typecheck
```

### Step B: Publish
Run the release command from the root directory.

**Using NPM Login (Standard):**
```bash
pnpm run release
```

**Using Automation Token (Bypass 2FA):**
If you have an automation token, use the following command to bypass the interactive 2FA prompt:
```bash
pnpm run release --no-git-checks --_authToken=YOUR_NPM_TOKEN_HERE
```
*Note: Replace `YOUR_NPM_TOKEN_HERE` with your actual token.*

---

## 🛠 Manual/Emergency Release
If you need to bypass changesets and publish the current versions manually:

1. **Bump versions manually** in `packages/core/package.json` and `packages/react/package.json`.
2. **Ensure dependencies are in sync**: `zipit-react` must depend on the new version of `zipit-core`.
3. **Run publish**:
   ```bash
   pnpm -r publish --access public --no-git-checks
   ```

## 📝 Checkpoint Checklist
- [ ] Build succeeds (`pnpm run build`)
- [ ] Tests pass (`pnpm run test`)
- [ ] Typecheck passes (`pnpm run typecheck`)
- [ ] Versions in `package.json` are correct
- [ ] READMEs are up to date
