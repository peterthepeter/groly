# Install Groly with Portainer

Deploy Groly as a **Stack** on a **Docker Standalone** environment. This example
does not target Docker Swarm or Kubernetes. It uses a single container and a
persistent bind mount for the SQLite database, uploads, and local upgrade backups.

**Validation status:** The Compose YAML syntax has been checked locally. Deployment
and updates through Portainer have not yet been tested. Environment substitution,
storage permissions, HTTPS, and persistence still need validation in Portainer.

## Requirements

- A Linux Intel/AMD (`amd64`) Docker host managed by Portainer.
- Permission to create stacks in the chosen Docker Standalone environment.
- An existing absolute data path on that Docker host, with space for data and
  backups. This is not a path on your browser's computer or necessarily on the
  machine running Portainer Server.
- A hostname, trusted HTTPS certificate, and an existing reverse proxy or tunnel
  that can reach the Docker host. See the
  [HTTPS options](../../README.md#https).

## 1. Prepare storage on the Docker host

Create a dedicated directory on the Docker host selected in Portainer. For a
regular Linux host, an administrator can use:

```sh
sudo mkdir -p /srv/groly/data
sudo chown -R 1000:1000 /srv/groly/data
```

For a NAS, use its actual shared-folder path and permissions tools instead. The
image entrypoint attempts the ownership adjustment before running the application
as UID/GID `1000:1000`; inherited ACLs must also allow write access. Leave the
image's startup user unchanged. Do not use world-writable permissions or enable
privileged mode.

Keep the directory across redeployments, and run only one Groly instance against
it. Use an absolute bind-mount path; relative paths in a Portainer stack are not a
portable way to refer to your intended host directory.

## 2. Create the stack

1. Select the correct **Docker Standalone** environment in Portainer.
2. Open **Stacks > Add stack**, name it `groly`, and select **Web editor**.
3. Copy [docker-compose.yml](docker-compose.yml) from GitHub's **Raw** view into
   the editor.
4. In the stack's **Environment variables** form, enter:

| Name | Value |
| --- | --- |
| `GROLY_DATA_DIR` | Your existing absolute Docker-host path, for example `/srv/groly/data`. |
| `ADMIN_USERNAME` | Your initial Groly administrator username. |
| `ADMIN_PASSWORD` | Your own strong, unique password. No default is provided. |
| `ORIGIN` | Your exact HTTPS browser URL, for example `https://groly.example.com`, with any non-default port and no path. |
| `GROLY_PORT` | Optional host port; defaults to `3000`. |

Enter the actual values in these form fields, without surrounding YAML quotes or
doubling dollar signs. They supply the `${...}` substitutions in the Compose
file. This example does not use an `env_file: stack.env` directive or require a
local `.env` file. Keep stack configuration and environment values private.

5. Deploy the stack. Open its container logs and check startup. The health check
   allows ten minutes for initialization and upgrade backups.

Portainer pulls `ghcr.io/peterthepeter/groly:latest`. A local build and separate
database container are not needed. Do not deploy the same data directory through
a second stack or a separate `docker compose up` command.

## 3. Connect HTTPS

Route your HTTPS hostname to **HTTP on the selected Docker host's private IP and
published Groly port**, for example `http://192.168.1.40:3000`. Use the Docker
environment's host address, which can differ from Portainer Server's address.
A proxy in a separate container must not use its own `127.0.0.1` to reach Groly.

The browser URL must exactly match `ORIGIN`. Use a dedicated hostname rather than
a `/groly` subpath. HTTPS with a certificate trusted by your devices is required
for PWA installation, offline mode, push, camera scanning, and location features.

The example publishes the HTTP port on the host. Restrict that port to your proxy
or trusted network; do not forward it directly from the internet. Creating this
stack does not configure the proxy, DNS, certificate, or router automatically.

Leave `ADDRESS_HEADER` unset unless a trusted proxy reliably supplies the matching
client-IP header and users cannot bypass that proxy. It is not required for HTTPS.

## 4. First login and persistence check

Open the configured HTTPS URL and sign in with the initial administrator
credentials. You can change the password in Groly's settings. Groly credentials
are independent of your Portainer account.

Create a shopping list and a recipe with an uploaded image. Stop and start the
container through Portainer, then verify that both are still present. Check phone
access and PWA installation before relying on the setup.

After the first administrator exists, remove `ADMIN_PASSWORD` from **both** the
stack's environment-variable form and its Compose `environment` section, then
update the stack. Leaving the required `${ADMIN_PASSWORD:?...}` substitution in
the YAML will prevent deployment if the form value is removed. Keep
`ADMIN_USERNAME` for [password recovery](../../README.md#admin-password-recovery).

For push notifications, add the [VAPID variables](../../README.md#push-notifications-optional)
to the service's Compose `environment` mapping and supply their values, then
update the stack. Keep the same keys across updates.

## Updates and backups

1. Record the currently running image version or digest.
2. Stop the Groly container. Make an independent copy of the **complete host data
   directory**, including uploads and any SQLite `-wal`/`-shm` files. Save the
   stack YAML and its environment values securely. Keep the backup outside the
   data directory, preferably on another device.
3. Open the existing stack's **Editor**. Change `image` to the desired published
   stable version tag, for example `ghcr.io/peterthepeter/groly:1.0.0` (an example
   version), then update the stack. Preserve the host path and other settings.
   If keeping `:latest`, use Portainer's re-pull-image option during the stack
   update so it does not simply reuse a cached image. Labels vary by version.
4. Check startup logs, health, login, and your saved list and uploaded image.

A restart alone does not update the image. Do not remove the stack or its data to
perform an update. Groly's automatic pre-upgrade backups need free space and do
not replace independent backups. See the
[upgrade and restore guide](../UPGRADING.md#english) before rolling back after a
database migration.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| A required variable is missing | Enter the exact variable names and non-empty values in the stack's Environment variables form. |
| Data appears missing | Confirm `GROLY_DATA_DIR` refers to the original directory on the selected Docker host, not the Portainer Server host. |
| Permission denied or database cannot open | Check the bind mount, ownership, ACLs, and UID/GID `1000:1000` write access. Do not delete the database. |
| No matching image manifest | The Docker host must be Intel/AMD; the image does not currently support ARM. |
| Port already allocated | Set a free `GROLY_PORT` and update the proxy destination. |
| Proxy returns 502 | Check the selected Docker host's IP, published port, and Groly health. |
| Login or form submission fails | Check that the browser URL matches `ORIGIN` and uses trusted HTTPS. |

## Official reference

- [Portainer: Add a new stack](https://docs.portainer.io/user/docker/stacks/add)
