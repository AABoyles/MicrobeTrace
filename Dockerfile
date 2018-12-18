FROM node:8

# Copy dependency info
COPY package*.json /usr/src/app/

# Change working directory
WORKDIR /usr/src/app/

# Install dependencies
RUN npm install

# Copy source code
COPY . /usr/src/app/

# Expose API port to the outside
EXPOSE 5000

# Launch application
CMD ["npm","start"]
