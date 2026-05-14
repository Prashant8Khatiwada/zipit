# Contributing to ZipIt

Thank you for your interest in contributing to ZipIt! This project aims to provide the best client-side batch download and ZIP streaming experience for the web.

## Development Workflow

This is a monorepo managed with `pnpm`.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Prashant8Khatiwada/zipit.git
   cd zipit
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Build the project**:
   ```bash
   pnpm run build
   ```

4. **Run development mode**:
   ```bash
   # Starts watch mode for core and react packages
   pnpm run dev
   ```

## Coding Standards

- **TypeScript**: Strict mode is enabled. Ensure all exports have proper types and JSDoc comments.
- **Functional Style**: Prefer functional, composable design over class-based APIs where possible (though internal engines use classes for state management).
- **Zero Dependencies**: Core package should have zero mandatory runtime dependencies (besides peer deps like `fflate`).

## Testing

We use `Vitest` for testing.

```bash
# Run tests for all packages
pnpm run test

# Run tests with coverage
pnpm run test:coverage
```

When adding new features, please include corresponding unit tests in the `tests/` directory of the relevant package.

## Pull Request Process

1. Create a new branch from `main`.
2. Ensure tests pass and typecheck succeeds.
3. Update `CHANGELOG.md` with your changes.
4. Submit a PR and wait for review.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
