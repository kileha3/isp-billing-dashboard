# Use official Node.js image
FROM node:24-alpine AS builder

# Set working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

RUN npm install

# Copy the rest of the application files
COPY . .

# Build the Next.js app
RUN npm run build

# Use a minimal image for production
FROM node:24-alpine AS runner
WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Start the Next.js app
CMD ["npm", "run", "start"]