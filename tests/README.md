# Tests directory

The course spec refers to a top-level `tests/` folder. In this monorepo, **automated tests are implemented under [`backend/__tests/`](../backend/__tests__/)** using **Vitest**.

From the **repository root**, run:

```bash
npm test
```

This executes `npm run test -w backend` (see root [`package.json`](../package.json)).
