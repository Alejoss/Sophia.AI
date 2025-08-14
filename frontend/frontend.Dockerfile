# Use an official Node.js runtime as a parent image
FROM node:16

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 5173

# Define environment variable
ENV NODE_ENV=development

# Run the app when the container launches using the Vite command with --host
CMD ["npm", "run", "dev", "--", "--host"]
