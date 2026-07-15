# Deploying Tyqro on Vercel (React + Django REST Framework)

Since Tyqro has been migrated to a decoupled SPA (Single Page Application) architecture, the cleanest, fastest, and most standard way to host it on Vercel is to deploy the **Frontend** and **Backend** as two separate connected projects from the same GitHub repository. 

This ensures that:
1. The React app is served instantly from Vercel's global Edge CDN.
2. The Django API runs as stateless Python serverless functions, avoiding size package bloat.

---

## Part 1: Deploying the Python Backend (Django REST API)

1. **Create a New Project on Vercel**:
   * Go to your Vercel Dashboard and click **Add New** -> **Project**.
   * Import your GitHub repository.
2. **Configure the Project**:
   * **Project Name**: `tyqro-api` (or similar).
   * **Framework Preset**: Choose **Other** (do *not* choose Next.js/Vite).
   * **Root Directory**: Keep it as the root directory `./` (leave it empty).
3. **Set Environment Variables**:
   Add the variables from your local `.env` file under the **Environment Variables** section:
   * `SECRET_KEY` = *your_django_secret_key*
   * `DEBUG` = `False`
   * `DATABASE_URL` = *your_supabase_postgres_url*
   * `CLOUDINARY_CLOUD_NAME` = *your_cloudinary_cloud_name*
   * `CLOUDINARY_API_KEY` = *your_cloudinary_api_key*
   * `CLOUDINARY_API_SECRET` = *your_cloudinary_api_secret*
   * `EMAIL_HOST_USER` = *your_email_address*
   * `EMAIL_HOST_PASSWORD` = *your_email_smtp_password*
   * `ALLOWED_HOSTS` = `*`
4. **Deploy**:
   * Click **Deploy**. Vercel will run `build_files.sh` to install dependencies and collect static files, then launch the Django app.
   * Note down your backend URL (e.g., `https://tyqro-api.vercel.app`).

---

## Part 2: Deploying the React Frontend (Vite)

1. **Create a New Project on Vercel**:
   * Import the **same** GitHub repository as a new Vercel project.
2. **Configure the Project**:
   * **Project Name**: `tyqro` (this will be your main website URL).
   * **Framework Preset**: Choose **Vite**.
   * **Root Directory**: Select `frontend` (this is critical!).
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
3. **Set Environment Variables**:
   Under **Environment Variables**, add the URL of the backend API you deployed in Part 1:
   * `VITE_API_URL` = `https://tyqro-api.vercel.app` (replace with your actual backend URL).
4. **Deploy**:
   * Click **Deploy**. Vercel will install npm packages, compile the React build, and serve your app.

---

## How It Works Together
* When a user visits `https://tyqro.vercel.app`, the static React website loads instantly.
* The frontend makes all authentication, task management, and session tracker network queries to the backend serverless endpoints on `https://tyqro-api.vercel.app/api/`.
* JWT tokens are saved and secure. Supplying `CORS_ALLOW_ALL_ORIGINS = True` in settings allows cross-origin requests from the React client.
