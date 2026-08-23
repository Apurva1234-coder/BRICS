echo "Building frontend and backend..."
npm run build

echo "Deploying to Firebase..."
firebase deploy --only functions,hosting,firestore

echo "Deployment complete!"
