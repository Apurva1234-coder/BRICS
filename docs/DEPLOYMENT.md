# Deployment Guide (Hackathon Demo Mode)

For hackathon purposes, CleanAir Sentinel is optimized for a single-container deployment on **Google Cloud Run**. This deployment strategy is explicitly designed to be fast, zero-configuration, and highly resilient for demo presentations.

## Deployment Architecture
- **Single Service**: Both the React Frontend (Vite build) and Express Backend are served by a single Node.js process.
- **Local Storage**: Uses local JSON files (`server/data/*.json`) to store reports and situations temporarily instead of a persistent database like Cloud SQL or Firestore.
- **Local Uploads**: Image uploads are saved to the container's temporary filesystem (`/tmp/media` or `storage/`) instead of Cloud Storage buckets.
- **No External Databases Required**: Reduces points of failure during live demos.

## Prerequisites
1. [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install) installed.
2. Docker installed locally (optional, for local testing).
3. A Google Cloud Project with Billing enabled.

## Deployment Steps

### 1. Configure your Environment Variables
Copy the `deploy.env.yaml.example` file to `deploy.env.yaml` and fill in your keys:
```bash
cp deploy.env.yaml.example deploy.env.yaml
```

**Required in `deploy.env.yaml`:**
```yaml
GEMINI_API_KEY: "YOUR_KEY"
DATA_GOV_API_KEY: "YOUR_KEY"
OPENAQ_API_KEY: "YOUR_KEY"
DEMO_MODE: "true"
```
*(Note: `DEMO_MODE="true"` strictly forces the app to use local memory/disk instead of requiring external database configurations).*

### 2. Build and Deploy using gcloud
Run the following exact command from the root of the repository. This will automatically package the app using Google Cloud Build (via the provided `Dockerfile`) and deploy it to Cloud Run.

```bash
gcloud run deploy cleanair-sentinel \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file deploy.env.yaml \
  --memory 1Gi \
  --port 8080
```

### 3. Verify Deployment
Once the command completes, `gcloud` will output a Service URL (e.g., `https://cleanair-sentinel-xxx-uc.a.run.app`). 
1. Open the URL in your browser. The frontend should load immediately.
2. Navigate to `/api/health` to verify the backend is active.
3. Submit a test report to verify local image uploads are functioning inside the container.

---

### Alternative Free-Tier Deployments
If you do not have Google Cloud Billing enabled, you can deploy this exact same architecture for free on platforms like **Render** or **Netlify**:
- **Netlify**: The repository includes a `netlify.toml` and functions wrapper. Simply run `npx netlify deploy --build --prod` and import your `.env` file via the Netlify dashboard.
- **Render**: Connect the GitHub repository, set Build Command to `npm run build`, Start Command to `npm run start`, and deploy as a Web Service.
