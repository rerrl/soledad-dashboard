This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Development Mode

```bash
yarn install
yarn dev
```

## Docker (Local Production)

```bash
docker build -t soledad-dashboard .
docker run -p 3000:3000 soledad-dashboard
```

In both cases, the app will be served at [http://localhost:3000](http://localhost:3000).

## Database

The app uses SQLite via knex.js. The database file lives at `./data/lotops.db` (gitignored).

```bash
# Run all pending migrations
yarn migrate

# Roll back the last batch of migrations
yarn migrate:rollback

# Populate with ~23 sample vehicles for development
yarn seed

# Full reset
rm -rf data && yarn migrate && yarn seed
```
