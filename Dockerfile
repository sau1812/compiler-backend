# Base image jisme Node.js pehle se hai
FROM node:18-bullseye

# Python, C++ (g++) aur Java install karo
RUN apt-get update && apt-get install -y python3 g++ default-jdk

# Working directory set karo
WORKDIR /app

# Dependencies install karo
COPY package*.json ./
RUN npm install

# Baaki saara code copy karo
COPY . .

# Port expose karo
EXPOSE 2000

# Server start karo
CMD ["node", "server.js"]