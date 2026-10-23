# Install Groly on QNAP

Run Groly as a Compose **Application** in Container Station 3. This guide does not
create a QNAP `.qpkg` package or add Groly to App Center.

**Validation status:** The Compose YAML syntax has been checked locally. This
setup has not been tested on QNAP hardware. Installation, shared-folder
permissions, HTTPS, persistence, and updates still need validation on a real NAS.

## Requirements

- An Intel/AMD (`amd64`) QNAP NAS with Container Station 3 installed and working.
  The current Groly image does not support ARM QNAP models.
- A NAS administrator account and a dedicated local data directory.
- Space for the database, uploaded images, and upgrade backups.
- An HTTPS hostname, a certificate trusted by your devices, and a reverse proxy
  or tunnel that can reach the NAS. See the
  [HTTPS options](../../README.md#https).

## 1. Prepare the data folder

Use File Station to create a `groly` folder in your container shared folder, then
create a `data` subfolder. The example uses `/share/Container/groly/data`; your
shared folder may have a different name. Confirm its actual absolute path before
editing the Compose file.

Mount only this dedicated folder at `/app/data`. It holds the database, uploads,
and local upgrade backups. Preserve its path and contents across updates and
run only one Groly instance against it.

The entrypoint attempts to set ownership to UID/GID `1000:1000` before starting
the application as that user. Leave the image's startup user unchanged. If QNAP
shared-folder permissions or ACLs prevent this, grant the application user write
access to this directory. An administrator can adjust ownership over SSH, using
the actual path:

```sh
sudo chown -R 1000:1000 /share/Container/groly/data
```

Do not apply this to the entire shared folder, make the directory world-writable,
or enable privileged mode as a workaround for file permissions. Check QNAP ACLs
if ownership alone does not resolve the error.

## 2. Edit the Compose example

Open [docker-compose.yml](docker-compose.yml) and copy the YAML from GitHub's
**Raw** view. Before deploying, change:

| Setting | What to enter |
| --- | --- |
| Host path before `:/app/data` | Your existing, dedicated Groly data directory. |
| Host port in `3000:3000` | A free NAS port if `3000` is occupied. Keep the container port, on the right, at `3000`. |
| `ADMIN_USERNAME` | Username for the first Groly administrator. |
| `ADMIN_PASSWORD` | Your own strong, unique password. The empty example value prevents fresh initialization until you set it. |
| `ORIGIN` | Your exact HTTPS browser URL, including any custom port, with no path. |

There is no separate `.env` file for this example. Keep the edited YAML private.
Compose interprets `$` in inline values, even in YAML quotes. Use `$$` for a
literal `$`: a password containing `a$b` must be written as `'a$$b'` in the YAML.

## 3. Create the Container Station application

1. Open **Container Station > Applications > Create**.
2. Set the application name to `groly` and paste your edited Compose YAML.
3. Use **Validate** if available, then create the application.
4. Open its container logs and confirm successful startup. The health check
   allows ten minutes for initialization and upgrade backups.

Container Station downloads `ghcr.io/peterthepeter/groly:latest`. No local build or
separate database container is needed. A Web URL shortcut, if configured, does
not by itself provide HTTPS; use the endpoint described below.

## 4. Configure HTTPS access

Route your HTTPS hostname through your existing reverse proxy or tunnel to
**HTTP on the NAS's private IP and published Groly port**, for example
`http://192.168.1.30:3000`. A reverse proxy in another container must use a
reachable NAS address; its own `127.0.0.1` does not point to Groly.

The public-facing browser URL must exactly match `ORIGIN`. Use a dedicated
hostname, not a `/groly` subpath, and a certificate trusted by your devices.
HTTPS is required for PWA installation, offline mode, push, camera scanning,
and location features.

The example publishes the HTTP port on the NAS. Limit access to the proxy or
trusted network; do not forward this HTTP port directly from the internet. The
choice and installation of a proxy/tunnel, DNS, and certificate provisioning
remain separate from Container Station's application setup.

Leave `ADDRESS_HEADER` unset unless your trusted proxy supplies the matching
client-IP header and users cannot bypass the proxy. It is not required for HTTPS.

## 5. First login and persistence check

Open your configured HTTPS URL and sign in with the initial administrator
credentials. You can change the password in Groly's settings. Groly accounts are
separate from QNAP accounts.

Create a shopping list and a recipe with an uploaded image. Stop and start the
application, then check that both are still present. Also check your phone's
HTTPS access and PWA installation.

After the first administrator exists, remove `ADMIN_PASSWORD` from the application
YAML and recreate the application with the same data mount. Keep `ADMIN_USERNAME`
for [password recovery](../../README.md#admin-password-recovery). To enable push,
add the [VAPID variables](../../README.md#push-notifications-optional) under
`environment` and recreate the application. Keep the same keys across updates.

## Updates and backups

1. Record the currently running image version or digest.
2. Stop the Groly application. Make an independent copy of the **complete data
   folder**, including uploads and any SQLite `-wal`/`-shm` files. Save the
   application YAML privately as well. Keep the backup outside Groly's directory,
   preferably on another device.
3. Select the existing application and use **Recreate** (under the **Image** menu
   next to **Edit** in Container Station 3). Change `image` to your desired
   published stable version tag, for example
   `ghcr.io/peterthepeter/groly:1.0.0` (an example version). Keep the data path,
   environment, and port mapping unchanged, then apply the update. A new version
   tag avoids relying on a cached `latest` image.
4. Confirm the application starts, then check logs, health, login, and your saved
   list and uploaded image.

Menu labels can vary by Container Station version. A restart alone does not
update the image, and deleting the data folder is never part of an update.
Groly's automatic pre-upgrade backup needs free space and does not replace an
independent backup. Use the [upgrade and restore guide](../UPGRADING.md#english)
for recovery; reverting a database migration requires a matching backup.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No matching image manifest | Confirm the NAS uses an Intel/AMD processor, not ARM. |
| Initial startup fails | Check the non-empty initial password, existing data folder, and container logs. |
| Permission denied or database cannot open | Check the host path, UID/GID `1000:1000`, and shared-folder ACLs. Do not delete the database. |
| Port already allocated | Change only the host side of `3000:3000` and update the reverse-proxy destination. |
| Proxy returns 502 | Check container health and the destination NAS IP and published port. |
| Login or form submission fails | Confirm that the browser URL matches `ORIGIN` and has trusted HTTPS. |

## Official references

- [QNAP: How to use Container Station 3](https://www.qnap.com/en-us/how-to/tutorial/article/how-to-use-container-station-3)
- [QNAP: Container Station FAQ, including application recreation](https://www.qnap.com/en/how-to/faq/article/frequently-asked-questions-about-container-station)
