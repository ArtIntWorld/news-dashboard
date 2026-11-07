# News Dashboard (frontend)

React + TypeScript single-page app: pick a country and a section (Nature, Society, Technology)
and read that day's headlines. Built from `documents/News Dashboard Frontend Design Document.pdf`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, serves dummy data from MSW mocks
npm test           # Vitest + React Testing Library, API mocked with MSW
npm run lint       # oxlint (react, jsx-a11y)
npm run build      # type-check + production build to dist/
```

## Dummy data

Until the backend exists, `src/mocks/` answers `GET /api/countries` and `GET /api/news` in the
browser through a Mock Service Worker, with ~500 ms latency. The data is generated
deterministically, so each country and section always shows the same headlines:

- **Full coverage:** US, GB, IN, DE, FR, JP, CA, AU, BR, ZA, NG, KE.
- **Other countries:** a mix of normal, thin (fewer than 5) and empty results.
- **Antarctica (`AQ`):** always returns 500, to show the error view and Retry.

To use a real backend, copy `.env.example` to `.env`, set `VITE_USE_MOCKS=false`, and point the
proxy in `vite.config.ts` (development) or `VITE_API_BASE_URL` (hosted build) at the API.

## Structure (layered by type)

```
src/
  api/          types.ts (API contract), client.ts (apiGet + ApiError), endpoints.ts
  hooks/        useCountries, useNews (+ prefetch), useSelection (URL state)
  components/   CountrySelect, SectionTabs, ArticleList, ArticleCard
    states/     LoadingList, EmptyState, ErrorState
  pages/        NewsPage — owns the selection, children only render
  lib/          country default logic, section parsing, date formatting
  mocks/        dummy data and MSW handlers (browser + node)
  test/         test setup
```

Data flows one way: `pages` → `hooks` → `api`; components receive props and render.
