# Deploying to Render

The whole site is **one Docker web service**. The image (`Dockerfile`) builds the React app, publishes the ASP.NET Core server, and puts the built app in the server's `wwwroot`. One address serves both, so the strict same-site refresh cookie works and no CORS is needed. `render.yaml` is the Blueprint that describes the service.

You also need three things Render doesn't provide: a **MySQL 8** database, an **SMTP** account for the OTP emails, and **Cloudinary** for photos.

## Things to know before you start (checked November 2026)

| Topic | What it means |
|---|---|
| **Free web services can't send email over SMTP** | Render blocks outbound ports 25, 465 and 587 on the Free plan, so sign-up codes would time out. `render.yaml` uses the smallest paid size, `0.5c-512mb` (Starter, about $7/month), for that reason. On the Free plan you'd need an email service with an HTTP API (Brevo, Resend, …), which means changing `EmailSender`. |
| **Render has no MySQL** | Its managed database is Postgres only. Use an outside MySQL 8 host. |
| **Aiven's free MySQL is retired** | New free services stopped on 6 Nov 2026, and existing ones are deleted on 21 Dec 2026. The same Aiven MySQL on its paid Developer plan is the closest drop-in (no code change). Check the current price on [aiven.io](https://aiven.io/docs/platform/concepts/service-pricing). |
| **Free plan sleeps** | If you do use Free: it spins down after 15 minutes without traffic, and the next visit waits about a minute. |
| **Keep the database near the app** | `render.yaml` uses the Singapore region (closest to Nepal). Create the database in a nearby region too, since every query crosses the network. |

## 1. Get the code onto GitHub

Render builds from a branch on GitHub. Commit this work, push it, and merge it into `master` (or point the service at your branch when you create it).

## 2. Create the MySQL database

Any MySQL 8-compatible host works. The app only needs a connection string:

```
Server=<host>;Port=<port>;Database=<db name>;User=<user>;Password=<password>;SslMode=Required;
```

Hosted databases need `SslMode=Required`. The database can be empty: the server creates the tables on its first start (`Database__MigrateOnStartup=true`).

## 3. Collect the other credentials

- **SMTP:** for Gmail, an App Password (see "Email" in [AUTH.md](AUTH.md)): host `smtp.gmail.com`, port `587`, your address as user name and from address.
- **Cloudinary:** cloud name, API key and API secret from the dashboard.
- **Google Maps key** (optional): the map shows "unavailable" without it. The key ends up in the public JS bundle, so restrict it to your site's address under HTTP referrers in Google Cloud.
- **Admin login:** pick the email and a strong password for the first admin.

## 4. Create the service on Render

1. Render dashboard → **New → Blueprint** → connect the GitHub repo and choose the branch.
2. Render reads `render.yaml` and asks for each secret (`sync: false` values): the connection string, admin email and password, SMTP user, password and from-address plus host, Cloudinary values, and the Maps key. It generates `Jwt__SigningKey` itself.
3. **Apply.** The first build takes several minutes (Node build, then .NET publish).

On first start the server applies the migrations and creates the admin account. If a required setting is missing, it stops with a message that names the setting (see Troubleshooting).

## 5. Check it works

1. Open `https://<your-service>.onrender.com/healthz`. It should say `ok`.
2. Open the site root. The home page should load, and a deep link such as `/login` should too.
3. Log in as the admin, add a product with a photo, and check that the photo shows on the public page.
4. Sign up with a second email address. The 6-digit code should arrive by email.

Afterwards you can delete `Seed__Admin__Password` from the environment. It's only used while that email doesn't exist yet.

## 6. Your own domain (`panchamukhielectriccenter.com.np`)

Render → the service → **Settings → Custom Domains → Add**. Render shows the DNS records to create at your .com.np registrar, and it issues the HTTPS certificate automatically once they resolve. Then add the domain to your Google Maps key's HTTP referrer list.

## Settings reference

| Variable | Set in | Notes |
|---|---|---|
| `ConnectionStrings__Default` | Render (secret) | See step 2 |
| `Jwt__SigningKey` | Render (generated) | Changing it signs everyone out |
| `Seed__Admin__Email`, `Seed__Admin__Password` | Render (secret) | First admin only |
| `Email__Smtp__Host`, `Port`, `UserName`, `Password`, `FromAddress` | Render | The server won't start in production without SMTP |
| `Cloudinary__CloudName`, `ApiKey`, `ApiSecret` | Render (secret) | Without them, uploads return a clear 503 and everything else works |
| `Database__MigrateOnStartup` | `render.yaml` | `true` |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `render.yaml` and Dockerfile | Lets rate limiting see real client IPs behind Render's proxy |
| `PORT` | `render.yaml` | `10000`, matching the Dockerfile |
| `VITE_GOOGLE_MAPS_API_KEY` | Render | Read at **build** time. Changing it needs a new deploy |

## Troubleshooting

| Symptom | Cause |
|---|---|
| Deploy fails with `ConnectionStrings:Default is not set` | The variable is missing or misspelled (note the double underscores) |
| Deploy fails with `Email:Smtp is not configured` | `Email__Smtp__Host` or `__FromAddress` is empty |
| Deploy fails with `Invalid Jwt settings` | `Jwt__SigningKey` is under 32 bytes. Let Render generate it |
| Sign-up hangs, then errors | SMTP is blocked (Free plan) or the credentials are wrong. Check the service logs |
| First request after a while is very slow or errors once | The service or the database was asleep. The app retries database connections automatically |
| The map says "unavailable" | `VITE_GOOGLE_MAPS_API_KEY` wasn't set when the image was built. Set it and redeploy |
| Log warning "Failed to determine the https port for redirect" | Harmless. HTTPS ends at Render's proxy, not in the container |
| Log warning about DataProtection keys | Harmless. The app doesn't use data protection for anything it stores |

## Before real customers use it

- Use fresh production secrets. Don't reuse your development JWT key or passwords.
- The old Gmail password that was once hard-coded is still in git history. Revoke it in the Google account.

## Trying the image locally

```sh
docker build -t electriccenter .
docker run --rm -p 8080:10000 \
  -e "ConnectionStrings__Default=Server=host.docker.internal;Port=3307;Database=electriccenter;User=electriccenter;Password=<pw>;" \
  -e "Jwt__SigningKey=<32+ random chars>" -e Database__MigrateOnStartup=true \
  -e Email__Smtp__Host=smtp.example.invalid -e Email__Smtp__FromAddress=noreply@example.invalid \
  electriccenter
```

Then open http://localhost:8080. Emails aren't actually sent with that placeholder host.
