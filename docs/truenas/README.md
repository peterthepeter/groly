# Install Groly on TrueNAS

Use **Custom App > Install via YAML** on TrueNAS releases with Docker-based Apps
(24.10 and later). This guide does not apply to TrueNAS CORE or the older
Kubernetes-based Apps system. It does not add Groly to the TrueNAS app catalog.

**Validation status:** The Compose YAML syntax has been checked locally. This
setup has not been tested on TrueNAS. Installation, dataset permissions, HTTPS,
persistence, and updates still need validation on a real system.

## Requirements

- An Intel/AMD (`amd64`) TrueNAS system with Docker-based Apps configured.
- An administrator account and a dedicated data directory on a storage pool.
- Space for the database, uploaded images, and upgrade backups.
- An existing HTTPS reverse proxy or tunnel, a hostname, and a certificate trusted
  by your devices. See the [HTTPS options](../../README.md#https).

## 1. Prepare persistent storage

Before opening the app installation wizard, create a dedicated dataset or directory
for Groly, for example `/mnt/tank/apps/groly/data`. Replace `tank` with your actual
pool name. Use this directory only for Groly; do not mount an entire pool or an
existing shared media directory into the container.

This directory will contain the SQLite database, uploads, and local upgrade
backups. Keep the same path when updating or recreating the app, and run only one
Groly instance against it.

The image entrypoint attempts to set ownership of `/app/data` to UID/GID
`1000:1000`, then runs the application as that user. Leave the image's startup
user unchanged; do not add a `user:` override. If the dataset's ACLs prevent the
ownership adjustment, grant UID/GID `1000:1000` the required write access on this
dedicated dataset using TrueNAS's permissions tools. Do not change permissions on
the entire pool or make the dataset world-writable.

## 2. Edit the Compose example

Open [docker-compose.yml](docker-compose.yml) and use GitHub's **Raw** view to copy
the YAML. Edit these values before installation:

| Setting | What to enter |
| --- | --- |
| Host path before `:/app/data` | The existing dedicated data directory from step 1. |
| Host port in `3000:3000` | A free NAS port if `3000` is already in use. Keep the container port, on the right, at `3000`. |
| `ADMIN_USERNAME` | Username for the first Groly administrator. |
| `ADMIN_PASSWORD` | A strong, unique password. The empty example value intentionally prevents a fresh installation from initializing. |
| `ORIGIN` | The exact HTTPS URL you will use, such as `https://groly.example.com`, with any non-default port but no path. |

Values are embedded directly in this YAML; this installation does not use a
separate `.env` file. Keep your edited YAML private. Compose interprets `$` in
inline values: write `$$` for each literal `$`, including inside YAML quotes.
For example, a password containing `a$b` must be written as `'a$$b'` in the YAML.

## 3. Install the custom app

1. Go to **Apps > Discover Apps**.
2. Open the menu and choose **Install via YAML**. Labels and menu placement can
   vary by TrueNAS release; this is the Compose editor, not the guided image form.
3. Name the app `groly` and paste your edited Compose YAML.
4. Save to deploy the app, then open its logs and check startup.

The image is downloaded from `ghcr.io/peterthepeter/groly:latest`. No source build
or separate database service is needed. The health check allows ten minutes for
startup and upgrade backups; inspect logs if the app does not become healthy.

## 4. Connect HTTPS

Configure your existing reverse proxy or tunnel to send requests for your chosen
HTTPS hostname to **HTTP on the NAS's private IP and published Groly port**, for
example `http://192.168.1.20:3000`. A proxy in a separate container cannot reach
Groly through its own `127.0.0.1` address.

The browser URL must match `ORIGIN`, including the scheme and any custom port.
Use a dedicated hostname rather than a subpath such as `/groly`. HTTPS is required
for PWA installation, offline mode, push, camera scanning, and location features.

The example publishes port `3000` on the host. Restrict access to that HTTP port
to the proxy or trusted network using your network's access controls. Do not
forward it directly from the internet. This guide does not install a proxy or
configure public DNS, certificates, or router rules for you.

Leave `ADDRESS_HEADER` unset unless your trusted proxy reliably supplies the
matching client-IP header and users cannot bypass it. It is not needed for HTTPS.

## 5. First login and persistence check

Open your HTTPS URL and sign in with the initial credentials. You can change the
password in Groly's settings. Groly accounts are separate from TrueNAS accounts.

Create a list and a recipe with an uploaded image. Stop and start the app, then
confirm that both are still present. Check access on your phone and PWA
installation before relying on the setup.

After the first administrator exists, remove `ADMIN_PASSWORD` from the saved app
YAML and redeploy. Keep `ADMIN_USERNAME` for
[admin password recovery](../../README.md#admin-password-recovery). To enable
push, add the [VAPID variables](../../README.md#push-notifications-optional) under
`environment` and redeploy; retain those keys across updates.

## Updates and backups

1. Record the currently running image version or digest.
2. Stop the Groly app and make an independent copy of the **entire data directory**,
   including uploads and any SQLite `-wal`/`-shm` files. Keep a private copy of the
   app YAML as well. Keep the backup outside the app's directory, preferably on
   another device.
3. Edit the existing custom app's YAML. For an explicit update, change the image
   to the desired published stable tag, for example
   `ghcr.io/peterthepeter/groly:1.0.0` (an example, not a promise of the latest
   version). Save and redeploy, preserving the data mount and configuration.
   Changing to a new version tag avoids relying on a cached `latest` image.
4. Check logs, health, login, and the saved list and image again.

A restart alone does not update the image. Do not delete the app or dataset as an
update procedure. Groly's automatic pre-upgrade snapshots require free space and
do not replace independent backups. Follow the
[upgrade and restore guide](../UPGRADING.md#english) for recovery; a database
migration can require restoring a matching backup before using an older image.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Initial startup fails | Confirm `ADMIN_PASSWORD` is non-empty and the data directory exists. Read the app logs. |
| Permission denied or database cannot open | Check the dataset mount and UID/GID `1000:1000` access, including inherited ACLs. Do not delete the database. |
| Startup stays unhealthy | Check free space, permissions, and backup errors in the logs. |
| Proxy returns 502 | Check the app's health and the NAS IP/host port used by the proxy. |
| Login or form submission fails | Check that the browser URL exactly matches `ORIGIN` and uses trusted HTTPS. |

## Official reference

- [TrueNAS: Installing Custom Apps](https://apps.truenas.com/managing-apps/installing-custom-apps/)
