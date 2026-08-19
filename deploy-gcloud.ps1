$SERVICE_NAME="cleanair-sentinel-demo"
$REGION="us-central1"

echo "Deploying $SERVICE_NAME to Google Cloud Run..."
echo "Ensure you have copied deploy.env.yaml.example to deploy.env.yaml and filled it out."

gcloud run deploy $SERVICE_NAME `
  --source . `
  --region $REGION `
  --allow-unauthenticated `
  --env-vars-file deploy.env.yaml `
  --max-instances 1 `
  --port 8080

echo "Deployment complete."
