# Install Groly on Unraid

This guide covers the existing Unraid Community Applications integration. The
[XML template](../../unraid/groly.xml) keeps its original path and download URL.
This documentation reorganization does not revalidate the setup on Unraid.

## Installation

Install via **Community Applications** (search for "Groly") or add the template manually:

- **Template URL:** [groly.xml](https://raw.githubusercontent.com/peterthepeter/groly/main/unraid/groly.xml)
- **Repository:** `ghcr.io/peterthepeter/groly:latest`
- **Port:** `3000` (WebUI)
- **Path:** `/app/data` → e.g. `/mnt/user/appdata/groly`
- **Variables:** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ORIGIN`
- **Push notifications (optional):** additionally set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` — see [Push Notifications](../../README.md#push-notifications-optional)

The volume `/app/data` contains the SQLite database. An admin user is created on first start with the credentials from `ADMIN_USERNAME` and `ADMIN_PASSWORD`. After the first start, remove `ADMIN_PASSWORD` from the container; keep `ADMIN_USERNAME` for password recovery — `ADMIN_PASSWORD` is never re-applied. If you ever forget your admin password, see [Admin Password Recovery](../../README.md#admin-password-recovery).

> **File permissions:** The application runs as user `node` (UID 1000, GID 1000). The container entrypoint adjusts ownership of `/app/data` before starting the application. If your host prevents this adjustment, set ownership on the host:
> ```bash
> chown -R 1000:1000 /mnt/user/appdata/groly
> ```
> Keep the existing directory and its contents when upgrading. The application needs write access to create its pre-upgrade backup and open the database.

> **Architecture:** The Docker image is built for `linux/amd64`.

## HTTPS and first login

Configure a reverse proxy or tunnel for the HTTPS URL in `ORIGIN` using the
[HTTPS guidance](../../README.md#https). Route it to the NAS's published Groly
port; do not forward the HTTP port directly from the internet. A proxy in a
separate container must use a reachable NAS address, not its own `127.0.0.1`.

Open that HTTPS URL and sign in with the initial administrator credentials.
Create a list and upload a recipe image, then stop and start the container to
check that the data remains present. Groly accounts are separate from Unraid
accounts; see [User Management](../../README.md#user-management).

For the full variable reference, see
[Environment Variables](../docker/README.md#environment-variables).

## Updates and backups

Before an update, record the current image version or digest. Stop Groly and make
an independent copy of the complete mapped appdata directory, including uploads
and any SQLite `-wal`/`-shm` files. Save the container configuration privately as
well. Keep the backup outside Groly's data directory, preferably on another device.

Update the existing container through Unraid's Docker management interface,
keeping the data mapping, environment, and port configuration. Do not delete or
recreate the appdata directory as part of an update. Check logs, health, login,
and the saved list and uploaded image afterward.

Groly's automatic pre-upgrade backups need free space and do not replace an
independent backup. See the [upgrade and restore guide](../UPGRADING.md#english)
for recovery and the [beta-channel notes](../docker/README.md#beta-channel-optional)
before opting into `:beta`. Reverting a database migration can require restoring
a matching backup before using an older image.
