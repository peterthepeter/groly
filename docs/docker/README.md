# Install Groly with Docker Compose

Use the repository's [Compose file](../../docker-compose.yml) to run Groly on a
Linux Intel/AMD (`amd64`) Docker host. Install Docker Engine and the Docker Compose
plugin on the host first. The published image does not currently support ARM.

For NAS-specific setup, see the [deployment guides](../../README.md#deployment).

## Image

The image is published to GitHub Container Registry and can be pulled directly:

```
ghcr.io/peterthepeter/groly:latest
```

## Configure and start

1. Create a dedicated project folder and save the repository's
   [docker-compose.yml](../../docker-compose.yml) in it. On GitHub, use **Raw** or
   **Download raw file** to save the file contents.
2. Create a file named `.env` alongside it, using this example:

   ```dotenv
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=
   ORIGIN=https://groly.example.com
   ```

3. Fill in your own strong, unique `ADMIN_PASSWORD` before the first start. Put
   passwords containing `$` or `#` in single quotes in `.env`. Keep this file
   private and do not commit real credentials to Git.
4. Set `ORIGIN` to the exact HTTPS address you will use in your browser, including
   any non-default port but no path. Configure your reverse proxy or tunnel using
   the [HTTPS guidance](../../README.md#https). It must reach the Docker host's
   published HTTP port, normally `3000`; do not forward that HTTP port directly
   from the internet. A proxy in another container cannot use its own
   `127.0.0.1` to reach Groly.
5. From the project folder, start Groly:

   ```sh
   docker compose up -d
   docker compose logs -f groly
   ```

Open your configured HTTPS URL and sign in with the initial administrator
credentials. Groly uses its own accounts and does not offer public registration;
see [User Management](../../README.md#user-management).

The Compose file stores the database, uploads, and local upgrade backups in a
Docker-managed named volume, `groly-data`, whose actual name normally includes the
Compose project name. Keep the same project folder/name and volume across
updates. Do not run `docker compose down -v`, which deletes the named volume.

The entrypoint adjusts `/app/data` ownership and runs the application as UID/GID
`1000:1000`. If you replace the named volume with a bind mount, use a dedicated,
writable host directory and retain it across updates. Do not override the image's
startup user or make the directory world-writable to work around permissions.

Once the first administrator exists, `ADMIN_PASSWORD` is no longer reapplied.
Remove the password from `.env` after initial setup; this repository's Compose
file allows the value to be empty on later starts. Keep `ADMIN_USERNAME` for
[password recovery](../../README.md#admin-password-recovery). Apply configuration
changes with `docker compose up -d`; a restart alone does not replace the
container's environment.

For push, follow [Push Notifications](../../README.md#push-notifications-optional).
The repository's Compose file already reads `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` from `.env` and supplies the same public
key to `PUBLIC_VAPID_PUBLIC_KEY`.

## Updates and backups

Before updating, record the running image version or digest. Stop Groly and make
an independent copy of the complete data volume, including uploads and any
SQLite `-wal`/`-shm` files, plus a private copy of your Compose configuration and
`.env`. Keep the backup outside the data volume, preferably on another device.
Use Docker's volume backup tooling for a named volume. Then, from the same project
folder, run:

```sh
docker compose pull
docker compose up -d
```

Check logs, health, login, and existing lists and uploaded images after updating.
A restart alone does not pull or apply a new image. Groly creates local snapshots
before version upgrades, but these need free space and do not replace independent
backups. See the [upgrade and restore guide](../UPGRADING.md#english) before
rolling back a database migration.

## Beta channel (optional)

Two image tags are published:

- `:latest` — stable releases. **Recommended for everyone.**
- `:beta` — pre-release builds for early testing. Opt-in only.

To help test upcoming changes, switch your image tag to `:beta`:

```yaml
    image: ghcr.io/peterthepeter/groly:beta
```

Everyone staying on `:latest` is unaffected by beta builds. To leave the beta channel, switch the tag back to `:latest` and pull again.

> **Back up your database before switching to `:beta`.** Beta builds may apply new database migrations that do not yet exist in `:latest`. Returning to `:latest` afterwards can fail if a newer migration has already run. The database lives in the `/app/data` volume — copy it somewhere safe first.

Groly 1.0 creates verified database and upload backups before version upgrades and keeps your existing container configuration. See the [upgrade and restore guide](../UPGRADING.md#english), including free-space requirements and the effect of the meal-plan date fix on older entries.

## Environment Variables

These are container environment variables. The repository's Compose file reads
only the `.env` values it explicitly references. To use additional variables such
as `ADMIN_PASSWORD_RESET`, `ADDRESS_HEADER`, or `OFF_COUNTRY`, add them under the
service's `environment` section as well; adding them only to `.env` does not pass
them into the container. After editing Compose settings, recreate the container
with `docker compose up -d`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Path to the SQLite file, e.g. `/app/data/groly.db` |
| `ORIGIN` | Yes | Full URL of your instance, e.g. `https://groly.example.com` |
| `ADMIN_USERNAME` | First run only | Username for the initial admin account. After first start can be deleted, but must be present (with the original value) if you ever need to use `ADMIN_PASSWORD_RESET`. |
| `ADMIN_PASSWORD` | First run only | Password for the initial admin account. **Only used when no users exist yet.** Can — and should — be deleted from the container after first start. To reset a forgotten admin password, use `ADMIN_PASSWORD_RESET` instead. |
| `ADMIN_PASSWORD_RESET` | Emergency only | If set, resets the password of the user defined in `ADMIN_USERNAME` to this value on container start and invalidates all their existing sessions. Leave empty in normal operation — see [Admin Password Recovery](../../README.md#admin-password-recovery). |
| `VAPID_PUBLIC_KEY` | Optional | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | Optional | VAPID private key for push notifications |
| `PUBLIC_VAPID_PUBLIC_KEY` | Optional | Same value as `VAPID_PUBLIC_KEY` |
| `VAPID_SUBJECT` | Optional | `https://` URL or `mailto:` address for VAPID |
| `ADDRESS_HEADER` | Optional | Set to `X-Forwarded-For` **only** when running behind a reverse proxy (Caddy, Nginx, Traefik). **Do not set this if you're accessing Groly directly** — it will cause login failures. Enables accurate per-client IP rate limiting. |
| `OFF_COUNTRY` | Optional | Restricts the nutrition tracker's Open Food Facts product search to a single country for more locally relevant results, e.g. `germany`, `france`, `switzerland`. Leave unset to search worldwide (default). |
