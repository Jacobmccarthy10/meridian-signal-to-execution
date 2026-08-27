# Meridian Signal to Execution

Local, static click-through prototype showing a plausible in-tenant Microsoft workflow:

**Outlook retailer email → Teams synopsis → buyer proposal → guardrail validation → confirmation → unsaved Dynamics 365 draft**

The prototype uses illustrative data only. It does not connect to Outlook, Teams, Databricks, Dynamics 365, Power Automate, or any external service.

## Run locally

```bash
npm run dev
```

Open `http://localhost:4173`.

## Validate and build

```bash
npm test
npm run build
```

The build output is written to `dist/`.
