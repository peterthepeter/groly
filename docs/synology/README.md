# Install Groly on Synology NAS

Run Groly with Docker Compose in Synology Container Manager. This is a deployment
guide, not a Synology `.spk` package.

**Validation status:** This configuration has not been tested on Synology hardware.
It follows Synology's documented Container Manager workflow and Groly's container
configuration. DSM labels can vary by version. Successful installation, updates,
and reverse-proxy behavior on a real NAS still need to be confirmed.

## Requirements

- An Intel/AMD (`x86-64` / `amd64`) Synology NAS with DSM 7.2 or newer and
  **Container Manager** installed from Package Center. The current Groly image
  does not support ARM models, even if they offer Container Manager.
- A DSM administrator account and space for Groly's data, uploads, and backups.
- An HTTPS hostname you control, such as `groly.example.com`, which resolves to
  the NAS from your devices, and a certificate trusted by those devices.

This guide uses DSM's built-in reverse proxy. It does not require Web Station.
The container's HTTP port is bound to `127.0.0.1`, so access goes through the
reverse proxy rather than directly through the NAS IP address.

## 1. Prepare the project folder

In File Station, create a `groly` folder inside your Docker shared folder, then
create a `data` subfolder. A typical layout is:

```text
/volume1/docker/groly/
  docker-compose.yml
  .env
  data/
```

Your shared folder or volume may have a different name. Use its actual path in
Container Manager. The Compose file uses `./data`, relative to the project folder,
so no `/volume1` path is hard-coded in it.

Download these two files from this directory and place them in the project folder:

- [docker-compose.yml](docker-compose.yml)
- [.env.example](.env.example), saved as **`.env`** (not `.env.example` or `.env.txt`).

GitHub displays files as pages; use **Raw** / **Download raw file** to save their
contents. You can also edit the environment file on your computer before uploading
it. Both files must be in the same project folder on the NAS.

Edit `.env`:

| Setting | What to enter |
| --- | --- |
| `ADMIN_USERNAME` | Username for the initial Groly administrator. |
| `ADMIN_PASSWORD` | Your own strong, unique password. It must not be empty. |
| `ORIGIN` | Your exact browser URL, for example `https://groly.example.com`. Include the port if HTTPS uses a non-default port. Do not add a path. |
| `GROLY_PORT` | A free local NAS port, normally `3000`. This is separate from the external HTTPS port. |

For passwords containing `$` or `#`, put the value in single quotes as shown in
the example file. Keep `.env` private and do not include it in support requests.

The container entrypoint tries to give UID/GID `1000:1000` ownership of `/app/data`
before starting the app. If startup logs show permission errors, check the
dedicated `data` folder's ownership and DSM permissions. A DSM administrator can
set ownership over SSH, substituting the actual project path:

```sh
sudo chown -R 1000:1000 /volume1/docker/groly/data
```

Apply this only to Groly's dedicated data directory. Do not change permissions on
the entire shared folder or use world-writable permissions.

## 2. Create the Container Manager project

1. Open **Container Manager > Project > Create**.
2. Set the project name to `groly` and select your Groly folder as the project path.
3. Use the prepared `docker-compose.yml` as the source. Depending on the wizard,
   select/upload the file or paste its contents into the YAML editor. Keep `.env`
   in the project folder so Compose can read it.
4. Leave the optional Web Station web portal disabled; HTTPS is configured below.
5. Finish the wizard and start the project.
6. Check the project's container logs for successful startup. The health check
   allows ten minutes for initialization and upgrade backups. A `healthy` status
   means Groly is ready; a restart by itself does not fix a startup error.

The image is pulled from `ghcr.io/peterthepeter/groly:latest`. There is no local
source build and no separate database container. Everything persistent is stored
in `data`, including the SQLite database, uploaded images, and upgrade backups.

## 3. Configure HTTPS in DSM

Prepare DNS and a valid certificate for your hostname first. DSM manages
certificates under **Control Panel > Security > Certificate**; you can import a
certificate or request one through the available certificate wizard. Certificate
issuance and renewal have their own domain-validation requirements.

Open **Control Panel > Login Portal > Advanced > Reverse Proxy > Create** and
configure:

| Field | Example |
| --- | --- |
| Name | `Groly` |
| Source protocol | `HTTPS` |
| Source hostname | `groly.example.com` |
| Source port | `443` |
| Destination protocol | `HTTP` |
| Destination hostname | `127.0.0.1` |
| Destination port | `3000` (or your chosen `GROLY_PORT`) |

Save the rule. In **Control Panel > Security > Certificate**, use the certificate
assignment settings to assign the correct certificate to the Groly reverse-proxy
hostname. Open the exact URL configured in `ORIGIN` and check that the browser
accepts the certificate.

Your network must allow clients to reach that HTTPS endpoint. Local DNS or a VPN
can keep access private. For intentional public access, route HTTPS to the NAS
and configure its firewall accordingly. Do not forward Groly's local HTTP port.

This example leaves `ADDRESS_HEADER` unset. Only enable it if your trusted proxy
supplies the corresponding client-IP header reliably and clients cannot bypass
that proxy. It is not required for HTTPS or origin validation.

## 4. Sign in and check the installation

Sign in with the administrator credentials from `.env`. You can change the
password in Groly's settings. Groly accounts are separate from DSM accounts.

Before relying on the installation, check that you can:

- Create a shopping list and add an item.
- Upload an image to a recipe and view it again.
- Stop and start the project without losing the list or image.
- Open Groly on your phone through the same HTTPS address and install the PWA.

HTTPS is required for offline mode, PWA installation, push notifications, barcode
scanning, and location-based list opening. Push notifications also need the
[optional VAPID configuration](../../README.md#push-notifications-optional).
To enable it, add those variables under `environment` in the Compose file, then
redeploy the project. Keep the same VAPID keys across updates.

Once the first account exists, `ADMIN_PASSWORD` is no longer reapplied at startup.
To remove the bootstrap password from disk, delete the `ADMIN_PASSWORD` entry
from **both** `.env` and the Compose `environment` section, then redeploy. Removing
only the `.env` value will fail the example's required-variable check. Keep
`ADMIN_USERNAME` for [admin password recovery](../../README.md#admin-password-recovery).

## Updates and backups

Before each update:

1. Record the currently installed image version or digest so you can identify it
   if recovery is needed.
2. Stop the Groly project.
3. Make an independent copy of the complete `data` folder while it is stopped,
   including any database `-wal`/`-shm` files and uploads. Back up the Compose file
   and `.env` securely as well. Keep the copy outside the project folder,
   preferably on another device.
4. In Container Manager's **Image** view, update/download the
   `ghcr.io/peterthepeter/groly:latest` image. Then rebuild/redeploy the existing
   project from its unchanged Compose configuration and start it. A simple
   restart continues using the old container image. Do not delete the project or
   its data folder to update it.
5. Check startup logs, health, login, and your saved list and image again.

If your DSM version does not provide a suitable update action, a DSM administrator
can use Compose over SSH from the existing project folder:

```sh
cd /volume1/docker/groly
sudo docker compose pull
sudo docker compose up -d
```

Use the actual project path and the same project name (`groly`) as in Container
Manager; add `-p groly` after `docker compose` if the folder name differs. These
commands assume the backup above has already been taken.

Groly 1.0 creates a verified local database/upload backup before version upgrades.
It still needs free space, and that local backup does not replace an independent
backup. See the [upgrade and restore guide](../UPGRADING.md#english) for storage
requirements and recovery. Do not simply select an older image after a database
migration; restore a matching backup when rolling back.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Compose reports a missing variable | Confirm the file is named `.env`, sits beside `docker-compose.yml`, and has non-empty required values. |
| No matching image manifest | Confirm the NAS is Intel/AMD. The published image currently does not support ARM. |
| Permission denied or database cannot open | Check the `data` mount, ownership, and DSM permissions. Do not delete the database. |
| Startup is blocked or health stays unhealthy | Read container logs. Check free disk space and write permissions; upgrade backups run before startup completes. |
| Reverse proxy returns 502 | Check that Groly is running and that the destination is `127.0.0.1` with the chosen `GROLY_PORT`. Direct LAN access to that HTTP port is intentionally disabled. |
| Login/form submission fails | Use the exact HTTPS URL in `ORIGIN`, including any custom port. Check the certificate and proxy rule. |
| PWA or camera features are unavailable | Use trusted HTTPS and check browser/device permissions. |

## Synology references

- [Container Manager projects](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project?version=7)
- [Container Manager images and updates](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_image?version=7)
- [DSM reverse proxy](https://kb.synology.com/en-global/DSM/help/DSM/AdminCenter/system_login_portal_advanced?version=7)
- [DSM certificates](https://kb.synology.com/en-global/DSM/help/DSM/AdminCenter/connection_certificate?version=7)
