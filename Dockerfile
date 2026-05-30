# Use Node.js LTS
FROM node:20

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose default Hugging Face port
EXPOSE 7860

# Set environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Start the Developer GUI console server
CMD ["npx", "tsx", "scripts/dev-gui.ts"]
