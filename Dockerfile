# Usar una imagen oficial de Node.js 20.x como base para la etapa de construcción
FROM node:20 AS build

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar el package.json y package-lock.json para instalar las dependencias
COPY package.json package-lock.json ./

# Instalar las dependencias de la aplicación
RUN npm install

# Copiar todo el código fuente de la aplicación al contenedor
COPY . .

# Realizar la compilación de la aplicación NestJS
RUN npm run build --workspace=mcs-parent-nest

# Usar una segunda etapa para crear una imagen de producción más ligera
FROM node:20-slim

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar el código compilado y las dependencias de la etapa de construcción
COPY --from=build /app/dist/apps/mcs-parent-nest /app/dist/apps/mcs-parent-nest
COPY --from=build /app/node_modules /app/node_modules

# Exponer el puerto en el que la aplicación escucha (por defecto, NestJS usa el puerto 3000)
EXPOSE 3000

# Definir el comando de inicio de la aplicación
CMD ["node", "dist/apps/mcs-parent-nest/main.js"]
