FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Set Vite API base URL to empty string so it uses relative paths for the deployed app
ENV VITE_API_BASE_URL=""

# Build the frontend and backend
RUN npm run build

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the Express production server
CMD ["npm", "run", "start"]
